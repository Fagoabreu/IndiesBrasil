import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import addressModel from "@/models/address";
import {
  allDayEndInstant,
  allDayStartInstant,
  eventCivilDate,
  eventCivilDayDiff,
  eventInstantOf,
  shiftEventDays,
  wallClockToInstant,
} from "@/lib/eventFormat";

/* ================================================================
 * LEITURA POR VISIBILIDADE
 * ================================================================ */

/**
 * Condição SQL que diz quais eventos um visitante pode **ler**.
 *
 * A regra de acesso da agenda mora em um lugar só — a lista (`findAll`) e o
 * detalhe (`findById`) têm de concordar. Não concordavam: `findById` não
 * filtrava nada, então um visitante sem sessão lia evento `private` (título e
 * descrição) só sabendo o UUID, enquanto a lista escondia o mesmo evento.
 * Esconder na lista e entregar no detalhe não é meia proteção — é a proteção
 * que não existe, já que o endereço do evento circula justamente por fora do
 * site: é o link que se compartilha.
 *
 * O que cada visibilidade significa (`visibility_type` no schema):
 *
 *  - `public`  — qualquer visitante, inclusive sem sessão;
 *  - `members` — qualquer usuário autenticado;
 *  - `private` — só quem criou ou foi convidado, e o convite **pendente** já dá
 *    acesso: sem isso o convidado não leria o evento que acabou de receber.
 *
 * @param {number|null} userIdParamIndex — índice do `$n` que carrega o id do
 *   visitante, ou `null` para visitante sem sessão.
 * @returns {string} trecho de SQL, sem `AND` na frente.
 */
function visibilityCondition(userIdParamIndex) {
  if (!userIdParamIndex) return "e.visibility = 'public'";

  return `(
    e.visibility IN ('public', 'members')
    OR e.created_by = $${userIdParamIndex}
    OR EXISTS (
      SELECT 1 FROM event_invitations ei2
      WHERE ei2.event_id = e.id
        AND ei2.invited_user_id = $${userIdParamIndex}
        AND ei2.status IN ('pending', 'accepted')
    )
  )`;
}

/* ================================================================
 * HELPERS
 * ================================================================ */

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/** Data civil de um `Date` usado como calendário (os campos UTC são a data). */
function civilOf(date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Data civil `date` com o horário de parede de `reference`. */
function withWallClockTime(date, reference) {
  return { year: date.year, month: date.month, day: date.day, hour: reference.hour, minute: reference.minute, second: reference.second };
}

/**
 * Retorna o N-ésimo dia-da-semana de um mês.
 * week: 1 = primeiro, 2 = segundo, -1 = último.
 * dayOfWeek: 0 = Dom, 1 = Seg, ..., 6 = Sáb.
 */
function getNthWeekdayOfMonth(year, month, dayOfWeek, week) {
  if (week >= 1) {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const diff = (dayOfWeek - firstDay.getUTCDay() + 7) % 7;
    const firstOccurrence = new Date(Date.UTC(year, month, 1 + diff));
    const result = new Date(Date.UTC(year, month, firstOccurrence.getUTCDate() + 7 * (week - 1)));
    return result.getUTCMonth() === month ? result : null; // overflow → próximo mês
  }
  if (week === -1) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const diff = (lastDay.getUTCDay() - dayOfWeek + 7) % 7;
    return new Date(Date.UTC(year, month, lastDay.getUTCDate() - diff));
  }
  return null;
}

/* ================================================================
 * ENGINE DE RECORRÊNCIA
 *
 * Expande uma regra de recorrência em pares {starts_at, ends_at}.
 * Gera instâncias de `eventStart` até `windowEnd` (ou rule.until_date).
 *
 * A aritmética acontece em **datas civis de Brasília** — o calendário que o
 * usuário vê, que é o que a regra descreve ("toda segunda", "todo dia 15"). A
 * versão anterior fazia a conta com `getUTCDay`/`Date.UTC` e usava o resultado
 * como instante: coincidia enquanto o horário de parede não cruzava a
 * meia-noite UTC, e errava duas famílias inteiras de evento — dia inteiro
 * (âncora `00:00` de Brasília = `03:00Z`) e qualquer evento a partir das 21h.
 * Em `expandDaily`, o horário era reconstruído com `Date.UTC` sem hora, então a
 * partir da 2ª ocorrência a instância voltava para `00:00Z` e o evento
 * reaparecia no dia anterior.
 * ================================================================ */

/**
 * Coleciona as ocorrências como datas civis e converte uma única vez.
 *
 * Cada ocorrência mantém o **horário de parede** do evento e o mesmo
 * deslocamento em dias: o término é o `endCivil` movido pelo mesmo número de
 * dias, e não "início + duração em ms". Assim um evento que vira a noite, ou de
 * vários dias, continua terminando na mesma hora, e a mudança de offset (o
 * horário de verão que o Brasil teve até 2019) não desloca as ocorrências.
 */
function makeInstancePusher(eventStart, eventEnd, until, maxCount) {
  const startCivil = eventCivilDate(eventStart);
  const endCivil = eventCivilDate(eventEnd);
  const instances = [];

  function push(civil) {
    const startsAt = eventInstantOf(civil);
    if (startsAt < eventStart || startsAt > until || instances.length >= maxCount) return;

    const dayOffset = eventCivilDayDiff(startCivil, civil);
    instances.push({
      starts_at: startsAt,
      ends_at: eventInstantOf(shiftEventDays(endCivil, dayOffset)),
    });
  }

  return { push, instances };
}

function expandDaily(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  let civil = eventCivilDate(eventStart);
  let remaining = maxCount;
  while (eventInstantOf(civil) <= until && remaining > 0) {
    push(civil);
    civil = shiftEventDays(civil, interval);
    remaining -= 1;
  }
}

function expandWeekly(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  const startCivil = eventCivilDate(eventStart);
  const weekdays = rule.days_of_week?.length > 0 ? [...rule.days_of_week].sort((a, b) => a - b) : [startCivil.weekday];
  // A grade de semanas é ancorada no domingo, como `days_of_week` (0 = Dom).
  let weekStart = shiftEventDays(startCivil, -startCivil.weekday);
  let remaining = maxCount;
  while (eventInstantOf(weekStart) <= until && remaining > 0) {
    for (const weekday of weekdays) {
      if (remaining <= 0) break;
      push(shiftEventDays(weekStart, weekday));
      remaining -= 1;
    }
    weekStart = shiftEventDays(weekStart, 7 * interval);
  }
}

function expandMonthly(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  const startCivil = eventCivilDate(eventStart);
  let year = startCivil.year;
  let month = startCivil.month;
  let remaining = maxCount;
  while (eventInstantOf({ year, month, day: 1 }) <= until && remaining > 0) {
    let day = null;
    if (rule.week_of_month != null && rule.days_of_week?.length > 0) {
      const nth = getNthWeekdayOfMonth(year, month - 1, rule.days_of_week[0], rule.week_of_month);
      day = nth && civilOf(nth);
    } else {
      const requested = rule.day_of_month ?? startCivil.day;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      day = { year, month, day: Math.min(requested, lastDay) };
    }
    if (day) {
      push(withWallClockTime(day, startCivil));
      remaining -= 1;
    }
    month += interval;
    if (month > 12) {
      year += Math.floor((month - 1) / 12);
      month = ((month - 1) % 12) + 1;
    }
  }
}

function expandYearly(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  const startCivil = eventCivilDate(eventStart);
  const months = rule.months_of_year?.length > 0 ? [...rule.months_of_year].sort((a, b) => a - b) : [startCivil.month];
  const lastYear = eventCivilDate(until).year + 1;
  let year = startCivil.year;
  let remaining = maxCount;
  while (year <= lastYear && remaining > 0) {
    for (const month of months) {
      if (remaining <= 0) break;
      push(withWallClockTime({ year, month, day: startCivil.day }, startCivil));
      remaining -= 1;
    }
    year += interval;
  }
}

/**
 * Término da recorrência como instante — o **último instante** do dia em "até".
 *
 * `until_date` é coluna `date`: um dia do calendário, não um instante. "Até 4 de
 * outubro" tem que incluir o dia 4, e o motor compara `startsAt > until` — usar
 * a meia-noite daquele dia cortava a última ocorrência, e usar a meia-noite do
 * dia seguinte incluía uma a mais.
 *
 * O driver entrega a coluna como `Date` à meia-noite **local**, então o dia é
 * lido com os acessores locais — que devolvem o dia gravado em qualquer fuso do
 * processo —, e não convertido para instante (isso reintroduziria o fuso na
 * leitura, que é justamente o defeito do dia inteiro).
 */
function recurrenceUntilInstant(untilDate) {
  if (!untilDate) return null;

  const civil =
    untilDate instanceof Date
      ? { year: untilDate.getFullYear(), month: untilDate.getMonth() + 1, day: untilDate.getDate() }
      : eventCivilDate(wallClockToInstant(untilDate));

  return new Date(eventInstantOf(shiftEventDays(civil, 1)).getTime() - 1);
}

export function expandRecurrenceRule(rule, eventStart, eventEnd, windowEnd) {
  const ruleUntil = recurrenceUntilInstant(rule.until_date);
  const until = ruleUntil && ruleUntil < windowEnd ? ruleUntil : windowEnd;
  const maxCount = rule.max_occurrences ?? 500;
  const { push, instances } = makeInstancePusher(eventStart, eventEnd, until, maxCount);

  switch (rule.frequency) {
    case "daily":
      expandDaily(rule, eventStart, until, maxCount, push);
      break;
    case "weekly":
      expandWeekly(rule, eventStart, until, maxCount, push);
      break;
    case "monthly":
      expandMonthly(rule, eventStart, until, maxCount, push);
      break;
    case "yearly":
      expandYearly(rule, eventStart, until, maxCount, push);
      break;
    default:
      break;
  }

  return instances;
}

/* ================================================================
 * QUERIES INTERNAS
 * ================================================================ */

async function createRecurrenceRule(rule) {
  const result = await database.query({
    text: `
      INSERT INTO event_recurrence_rules
        (frequency, interval, days_of_week, week_of_month, day_of_month, months_of_year, until_date, max_occurrences)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    values: [
      rule.frequency,
      rule.interval || 1,
      rule.days_of_week || null,
      rule.week_of_month ?? null,
      rule.day_of_month ?? null,
      rule.months_of_year || null,
      rule.until_date || null,
      rule.max_occurrences || null,
    ],
  });
  return result.rows[0];
}

async function insertInstances(eventId, instanceDates) {
  if (!instanceDates.length) return;

  const placeholders = instanceDates.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
  const values = [eventId, ...instanceDates.flatMap((d) => [d.starts_at, d.ends_at])];

  await database.query({
    text: `INSERT INTO event_instances (event_id, starts_at, ends_at) VALUES ${placeholders}`,
    values,
  });
}

const BASE_EVENT_QUERY = `
  SELECT
    e.*,
    u.username        AS organizer_username,
    u.avatar_image    AS organizer_avatar,
    ui.secure_url     AS organizer_avatar_url,
    COALESCE(bi.secure_url, e.banner_external_url) AS banner_url,
    COALESCE(rc.going,    0) AS rsvp_going,
    COALESCE(rc.maybe,    0) AS rsvp_maybe,
    COALESCE(rc.not_going, 0) AS rsvp_not_going,
    CASE WHEN a.id IS NOT NULL THEN json_build_object(
      'id',           a.id,
      'street',       a.street,
      'number',       a.number,
      'complement',   a.complement,
      'neighborhood', a.neighborhood,
      'city',         a.city,
      'state',        a.state,
      'zip_code',     a.zip_code,
      'country',      a.country
    ) END AS address
  FROM events e
  INNER JOIN users u  ON u.id = e.created_by
  LEFT JOIN  uploaded_images ui ON ui.id = u.avatar_image
  LEFT JOIN  uploaded_images bi ON bi.id = e.banner_image_id
  LEFT JOIN  addresses a        ON a.id  = e.address_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE status = 'going')     AS going,
      COUNT(*) FILTER (WHERE status = 'maybe')     AS maybe,
      COUNT(*) FILTER (WHERE status = 'not_going') AS not_going
    FROM event_rsvps
    WHERE event_id = e.id AND instance_id IS NULL
  ) rc ON true
`;

/**
 * Instantes de início e término a gravar, no contrato do model.
 *
 * O cliente manda o que o usuário digitou — o dia escolhido, o horário de
 * parede —, e traduzir isso em instante é do **servidor**: a regra precisa valer
 * para qualquer cliente. Foi um cliente deduzindo o fuso por conta própria
 * (`new Date` sobre o valor do input, que não tem fuso) que gravava o dia
 * inteiro à meia-noite UTC, uma noite antes em Brasília.
 *
 * Dia inteiro não tem hora: o início é a meia-noite de Brasília do dia escolhido
 * e o término é a meia-noite **seguinte ao último dia escolhido** (fim
 * exclusivo) — ver `allDayEndInstant` e o cabeçalho de `lib/eventFormat.js`.
 *
 * @param {object} data — `starts_at`, `ends_at`, `is_all_day` (como vieram no
 *   corpo ou como estão gravados).
 */
function resolveInstantRange(data) {
  if (data.starts_at == null || data.ends_at == null) {
    throw new ValidationError({ message: "Data de início e término são obrigatórias." });
  }

  const startsAt = parseInstant(data.starts_at, "início");
  const endsAt = parseInstant(data.ends_at, "término");

  // Os helpers de dia inteiro recebem o valor **cru**: uma data ("2026-10-14")
  // diz qual é o último dia incluído, um instante já diz qual é a fronteira de
  // término. Pré-converter apagaria essa diferença e encurtaria o evento em um
  // dia.
  const range = data.is_all_day
    ? { isAllDay: true, startsAt: allDayStartInstant(data.starts_at), endsAt: allDayEndInstant(data.ends_at) }
    : { isAllDay: false, startsAt, endsAt };

  if (range.endsAt < range.startsAt) {
    throw new ValidationError({
      message: "Data de término não pode ser anterior à de início.",
    });
  }

  return range;
}

/** Instante a partir do que chegou (data do input, ISO ou `Date`). */
function parseInstant(value, fieldLabel) {
  try {
    const instant = wallClockToInstant(value);
    if (Number.isNaN(instant.getTime())) throw new RangeError("Data inválida.");
    return instant;
  } catch {
    throw new ValidationError({ message: `Data inválida para "${fieldLabel}".` });
  }
}

/* ================================================================
 * API PÚBLICA DO MODEL
 * ================================================================ */

/**
 * Cria um evento e suas instâncias iniciais.
 * @param {object} data - Campos do evento + opcional `recurrence_rule`
 * @param {string} userId - UUID do usuário criador
 */
async function create(data, userId) {
  if (!data.title?.trim()) throw new ValidationError({ message: "Título é obrigatório." });
  if (!data.starts_at) throw new ValidationError({ message: "Data de início é obrigatória." });
  if (!data.ends_at) throw new ValidationError({ message: "Data de término é obrigatória." });

  const { startsAt, endsAt } = resolveInstantRange(data);

  if (data.is_recurring && !data.recurrence_rule) {
    throw new ValidationError({
      message: "Eventos recorrentes precisam de uma regra de recorrência.",
    });
  }

  const slug = `${slugify(data.title)}-${Date.now().toString(36)}`;

  let recurrenceRuleId = null;
  let rule = null;
  if (data.is_recurring && data.recurrence_rule) {
    rule = await createRecurrenceRule(data.recurrence_rule);
    recurrenceRuleId = rule.id;
  }

  /* Endereço estruturado (apenas para eventos presenciais) */
  let addressId = null;
  if (!data.is_online && data.address?.city) {
    const addr = await addressModel.create(data.address);
    addressId = addr.id;
  }

  const result = await database.query({
    text: `
      INSERT INTO events (
        title, slug, description, event_type, visibility, status,
        created_by, location_name, location_url, is_online, online_url,
        starts_at, ends_at, is_all_day, is_recurring, recurrence_rule_id, banner_image_id, banner_external_url,
        address_id, ticket_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `,
    values: [
      data.title.trim(),
      slug,
      data.description || null,
      data.event_type || "general",
      data.visibility || "public",
      data.status || "published",
      userId,
      data.location_name || null,
      data.location_url || null,
      data.is_online || false,
      data.online_url || null,
      startsAt,
      endsAt,
      data.is_all_day || false,
      data.is_recurring || false,
      recurrenceRuleId,
      data.banner_image_id || null,
      data.banner_external_url || null,
      addressId,
      data.ticket_url || null,
    ],
  });

  const event = result.rows[0];

  // Gerar instâncias (1 ano à frente)
  const windowEnd = new Date();
  windowEnd.setUTCFullYear(windowEnd.getUTCFullYear() + 1);

  let instanceDates = [];
  if (event.is_recurring && rule) {
    instanceDates = expandRecurrenceRule(rule, startsAt, endsAt, windowEnd);
  } else {
    instanceDates = [{ starts_at: startsAt, ends_at: endsAt }];
  }

  await insertInstances(event.id, instanceDates);

  return findById(event.id, userId);
}

/**
 * Busca um evento pelo ID, com contexto do usuário (RSVP, permissão de edição).
 */
async function findById(id, userId) {
  const values = [id];
  const userIdParamIndex = userId ? values.push(userId) : null;

  const result = await database.query({
    text: `
      ${BASE_EVENT_QUERY}
      WHERE e.id = $1
        AND ${visibilityCondition(userIdParamIndex)}
    `,
    values,
  });

  if (!result.rowCount) {
    // "Não encontrado" também cobre "não pode ver": dizer a diferença revelaria
    // que existe um evento ali que o visitante não tem direito de ler. É o
    // mesmo critério da conversa de outra pessoa (`models/conversation.js`).
    throw new NotFoundError({ message: "Evento não encontrado." });
  }

  const event = result.rows[0];

  // RSVP do usuário autenticado
  let userRsvp = null;
  if (userId) {
    const rsvpResult = await database.query({
      text: `SELECT status FROM event_rsvps WHERE event_id = $1 AND user_id = $2 AND instance_id IS NULL`,
      values: [id, userId],
    });
    if (rsvpResult.rowCount) userRsvp = rsvpResult.rows[0].status;
  }

  // Próximas instâncias (até 10)
  const instancesResult = await database.query({
    text: `
      SELECT id, starts_at, ends_at, is_cancelled, override_title, override_description
      FROM event_instances
      WHERE event_id = $1 AND is_cancelled = false AND ends_at >= NOW()
      ORDER BY starts_at ASC
      LIMIT 10
    `,
    values: [id],
  });

  // RSVPs de organizações ("going" apenas)
  const orgRsvpResult = await database.query({
    text: `
      SELECT
        r.organization_id,
        o.slug   AS org_slug,
        o.name   AS org_name,
        ui.secure_url AS org_logo_url
      FROM event_org_rsvps r
      INNER JOIN organizations o ON o.id = r.organization_id
      LEFT JOIN uploaded_images ui ON ui.id = o.img
      WHERE r.event_id = $1
      ORDER BY r.created_at ASC
    `,
    values: [id],
  });

  return {
    ...event,
    user_rsvp: userRsvp,
    is_owner: userId ? userId === event.created_by : false,
    upcoming_instances: instancesResult.rows,
    org_rsvps: orgRsvpResult.rows,
  };
}

/**
 * Lista eventos num intervalo de datas para o calendário.
 * Filtra por visibilidade de acordo com o usuário.
 * @param {{ from: Date, to: Date, userId?: string, type?: string, status?: string }} opts
 */
async function findAll({ from, to, userId, type, status = "published" }) {
  const fromDate = from ? new Date(from) : new Date();
  const toDate = to
    ? new Date(to)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return d;
      })();

  // Condições de visibilidade: a regra é a de `visibilityCondition`, a mesma
  // que o detalhe (`findById`) aplica — a lista e a página do evento não podem
  // discordar sobre quem enxerga o quê.
  const values = [fromDate, toDate, status];
  const userIdParamIndex = userId ? values.push(userId) : null;
  const visibilityClause = visibilityCondition(userIdParamIndex);

  const typeClause = type ? `AND e.event_type = $${values.push(type)}` : "";

  const result = await database.query({
    text: `
      SELECT DISTINCT ON (ei.id)
        ei.id            AS instance_id,
        ei.starts_at,
        ei.ends_at,
        ei.is_cancelled,
        ei.override_title,
        e.id             AS event_id,
        e.title,
        e.slug,
        e.description,
        e.event_type,
        e.visibility,
        e.status,
        e.is_online,
        e.is_all_day,
        e.is_recurring,
        e.created_by,
        /* O card do evento mostra o local do evento presencial; sem esta coluna
           a linha nunca aparecia na lista (a UI ja tratava location_name). */
        e.location_name,
        u.username       AS organizer_username,
        u.avatar_image   AS organizer_avatar,
        ui.secure_url    AS organizer_avatar_url,
        COALESCE(bi.secure_url, e.banner_external_url) AS banner_url,
        COALESCE(rc.going, 0) AS rsvp_going
      FROM event_instances ei
      INNER JOIN events e ON e.id = ei.event_id
      INNER JOIN users u  ON u.id = e.created_by
      LEFT JOIN  uploaded_images ui ON ui.id = u.avatar_image
      LEFT JOIN  uploaded_images bi ON bi.id = e.banner_image_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE status = 'going') AS going
        FROM event_rsvps
        WHERE event_id = e.id AND instance_id IS NULL
      ) rc ON true
      WHERE
        ei.starts_at < $2
        AND ei.ends_at  > $1
        AND ei.is_cancelled = false
        AND e.status = $3
        AND ${visibilityClause}
        ${typeClause}
      ORDER BY ei.id, ei.starts_at ASC
    `,
    values,
  });

  return result.rows;
}

/**
 * Lista para o sitemap: os eventos que o visitante **anônimo** pode ler.
 *
 * Duas condições, e as duas são de exposição, não de conveniência:
 *
 *  - `visibility = 'public'` — é o mesmo critério de `findAll` sem `userId`
 *    (`visibilityClause = "e.visibility = 'public'"`). `members` e `private`
 *    ficam de fora: o sitemap é público por natureza, então publicar esses
 *    endereços anunciaria conteúdo restrito.
 *  - `status = 'published'` — rascunho e cancelado não são páginas válidas.
 *
 * Devolve o `id` (não há `slug` na URL: `/agenda/<uuid>`) e `updated_at`, que é
 * o que o `<lastmod>` usa.
 *
 * Enumera **eventos**, não instâncias: `findAll` devolve uma linha por
 * ocorrência (`event_instances`) porque o calendário precisa delas, e um evento
 * recorrente apareceria repetido no sitemap — todas as cópias apontando para o
 * mesmo endereço.
 */
async function findAllForSitemap() {
  const result = await database.query({
    text: `
      SELECT e.id, e.updated_at
      FROM events e
      WHERE e.visibility = 'public'
        AND e.status = 'published'
      ORDER BY e.updated_at DESC
    `,
  });

  return result.rows;
}

/**
 * Atualiza campos de um evento (somente o criador pode editar).
 */
/**
 * Gerencia a criação/atualização/remoção do endereço associado ao evento.
 * Retorna o novo addressId a ser salvo, ou undefined se não houve mudança de FK.
 *
 * @param {{ address_id?: string }} event
 * @param {object|null} addressData
 */
async function handleAddressUpdate(event, addressData) {
  if (addressData && addressData.city) {
    if (event.address_id) {
      await addressModel.update(event.address_id, addressData);
      return undefined; // FK não muda
    }
    const addr = await addressModel.create(addressData);
    return addr.id;
  }
  if (addressData === null && event.address_id) {
    await addressModel.remove(event.address_id);
    return null;
  }
  return undefined;
}

async function update(id, data, userId) {
  const event = await findById(id, userId);

  if (event.created_by !== userId) {
    throw new ForbiddenError({
      message: "Apenas o organizador pode editar este evento.",
    });
  }

  if (event.status === "cancelled") {
    throw new ValidationError({
      message: "Não é possível editar um evento cancelado.",
    });
  }

  const allowed = [
    "title",
    "description",
    "event_type",
    "visibility",
    "status",
    "starts_at",
    "ends_at",
    "location_name",
    "location_url",
    "is_online",
    "online_url",
    "is_all_day",
    "banner_image_id",
    "ticket_url",
  ];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    // O intervalo é tratado junto, abaixo: mudar um dos lados ou marcar "dia
    // inteiro" reancora as duas pontas, e um `$n` por campo não daria conta.
    if (key === "starts_at" || key === "ends_at" || key === "is_all_day") continue;
    if (key in data) {
      values.push(data[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }

  // O que o evento vai ficar: o corpo sobre o que já está gravado. O `PATCH` do
  // formulário manda o intervalo inteiro, mas a regra não pode depender disso —
  // é justamente o cliente que se enganava com o fuso.
  const rangeChanged = "starts_at" in data || "ends_at" in data || "is_all_day" in data;
  let range = null;

  if (rangeChanged) {
    range = resolveInstantRange({
      starts_at: "starts_at" in data ? data.starts_at : event.starts_at,
      ends_at: "ends_at" in data ? data.ends_at : event.ends_at,
      is_all_day: "is_all_day" in data ? data.is_all_day : event.is_all_day,
    });

    values.push(range.startsAt, range.endsAt, "is_all_day" in data ? Boolean(data.is_all_day) : event.is_all_day);
    sets.push(`starts_at = $${values.length - 2}`, `ends_at = $${values.length - 1}`, `is_all_day = $${values.length}`);
  }

  /* Endereço estruturado: criar, atualizar ou limpar */
  if ("address" in data) {
    const newAddressId = await handleAddressUpdate(event, data.address);
    if (newAddressId !== undefined) {
      values.push(newAddressId);
      sets.push(`address_id = $${values.length}`);
    }
  }

  if (!sets.length) return event;

  values.push(id);
  await database.query({
    text: `UPDATE events SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
    values,
  });

  if (range) {
    await rescheduleInstances(id, range);
  }

  return findById(id, userId);
}

/**
 * Move as instâncias materializadas junto do intervalo do evento.
 *
 * A agenda e a home listam `event_instances`, não `events` (`findAll` faz
 * `DISTINCT ON (ei.id)`), e só o `create` gravava nessa tabela: editar a data
 * deixava a página do evento correta e o card na data antiga — parecia que a
 * alteração não tinha sido salva.
 *
 * As linhas são **deslocadas**, não recriadas: apagar e reinserir levaria junto
 * o `override_title`, o `is_cancelled` de cada ocorrência e os RSVP por
 * instância (`ON DELETE CASCADE`). A âncora é a primeira instância, que é o
 * `starts_at` do evento quando ela foi criada; cada uma recebe o mesmo
 * deslocamento em ms e a **duração nova** — assim uma alteração de duração vale
 * em todas as ocorrências, em vez de ficar só na primeira.
 *
 * @param {{ isAllDay: boolean, startsAt: Date, endsAt: Date }} range
 */
async function rescheduleInstances(eventId, range) {
  const result = await database.query({
    text: `SELECT id, starts_at FROM event_instances WHERE event_id = $1 ORDER BY starts_at ASC`,
    values: [eventId],
  });

  if (!result.rowCount) return;

  const deltaMs = range.startsAt.getTime() - new Date(result.rows[0].starts_at).getTime();
  const durationMs = range.endsAt.getTime() - range.startsAt.getTime();

  const ids = [];
  const starts = [];
  const ends = [];

  for (const row of result.rows) {
    const shiftedStart = new Date(new Date(row.starts_at).getTime() + deltaMs);
    const shiftedEnd = new Date(shiftedStart.getTime() + durationMs);

    // Dia inteiro tem que continuar na fronteira do dia de Brasília. Para o que
    // já estava, isto é no-op (`allDay*Instant` é idempotente); para instância
    // gravada pelo escritor antigo (`00:00Z`, que é a véspera em Brasília), é o
    // que a traz de volta para o dia certo.
    ids.push(row.id);
    starts.push(range.isAllDay ? allDayStartInstant(shiftedStart) : shiftedStart);
    ends.push(range.isAllDay ? allDayEndInstant(shiftedEnd) : shiftedEnd);
  }

  await database.query({
    text: `
      UPDATE event_instances AS ei
         SET starts_at = v.starts_at,
             ends_at   = v.ends_at
        FROM unnest($2::uuid[], $3::timestamptz[], $4::timestamptz[]) AS v(id, starts_at, ends_at)
       WHERE ei.id = v.id AND ei.event_id = $1
    `,
    values: [eventId, ids, starts, ends],
  });
}

/**
 * Cancela um evento (soft delete — mantém histórico).
 */
async function cancel(id, userId) {
  const event = await findById(id, userId);

  if (event.created_by !== userId) {
    throw new ForbiddenError({
      message: "Apenas o organizador pode cancelar este evento.",
    });
  }

  await database.query({
    text: `UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    values: [id],
  });
}

/* ================================================================
 * RSVP
 * ================================================================ */

/**
 * Insere ou atualiza a confirmação de presença do usuário no evento.
 * @param {string} eventId
 * @param {string} userId
 * @param {'going'|'maybe'|'not_going'} status
 * @param {string|null} instanceId - null para aplicar ao evento inteiro, uuid para instância específica
 */
async function upsertRsvp(eventId, userId, status, instanceId = null) {
  const validStatuses = ["going", "maybe", "not_going"];
  if (!validStatuses.includes(status)) {
    throw new ValidationError({
      message: `Status de RSVP inválido. Use: ${validStatuses.join(", ")}.`,
    });
  }

  // Verifica se o evento existe
  const eventResult = await database.query({
    text: `SELECT id, visibility, status AS event_status, created_by FROM events WHERE id = $1`,
    values: [eventId],
  });
  if (!eventResult.rowCount) throw new NotFoundError({ message: "Evento não encontrado." });

  const event = eventResult.rows[0];
  if (event.event_status === "cancelled") {
    throw new ValidationError({
      message: "Não é possível confirmar presença em evento cancelado.",
    });
  }

  // Evento privado: verificar convite
  if (event.visibility === "private" && event.created_by !== userId) {
    const inviteResult = await database.query({
      text: `SELECT id FROM event_invitations WHERE event_id = $1 AND invited_user_id = $2 AND status = 'accepted'`,
      values: [eventId, userId],
    });
    if (!inviteResult.rowCount) {
      throw new ForbiddenError({
        message: "Você precisa de um convite aceito para confirmar presença.",
      });
    }
  }

  if (instanceId) {
    // RSVP por instância
    await database.query({
      text: `
        INSERT INTO event_rsvps (event_id, instance_id, user_id, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ON CONSTRAINT uq_event_rsvp_instance DO NOTHING
      `,
      values: [eventId, instanceId, userId, status],
    });
    // ON CONFLICT sem índice nomeado — usar UPDATE
    await database.query({
      text: `
        UPDATE event_rsvps SET status = $4, updated_at = NOW()
        WHERE event_id = $1 AND instance_id = $2 AND user_id = $3
      `,
      values: [eventId, instanceId, userId, status],
    });
  } else {
    // RSVP global (evento inteiro)
    await database.query({
      text: `
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `,
      values: [eventId, userId, status],
    });
    await database.query({
      text: `
        UPDATE event_rsvps SET status = $3, updated_at = NOW()
        WHERE event_id = $1 AND user_id = $2 AND instance_id IS NULL
      `,
      values: [eventId, userId, status],
    });
  }

  return getRsvpCounts(eventId);
}

/**
 * Confirma presença de uma organização num evento.
 * Valida que o usuário é membro/admin/dono da org.
 */
async function upsertOrgRsvp(eventId, orgId, userId) {
  // Valida evento
  const eventResult = await database.query({
    text: `SELECT id, status AS event_status FROM events WHERE id = $1`,
    values: [eventId],
  });
  if (!eventResult.rowCount) throw new NotFoundError({ message: "Evento não encontrado." });
  if (eventResult.rows[0].event_status === "cancelled") {
    throw new ValidationError({
      message: "Não é possível confirmar presença em evento cancelado.",
    });
  }

  // Valida membro da org
  const memberResult = await database.query({
    text: `
      SELECT 1 FROM org_members WHERE org_id = $1 AND member_id = $2 AND status = 'active'
      UNION
      SELECT 1 FROM organizations WHERE id = $1 AND owner_id = $2
    `,
    values: [orgId, userId],
  });
  if (!memberResult.rowCount) {
    throw new ForbiddenError({ message: "Você não faz parte deste estúdio." });
  }

  await database.query({
    text: `
      INSERT INTO event_org_rsvps (event_id, organization_id, confirmed_by)
      VALUES ($1, $2, $3)
      ON CONFLICT ON CONSTRAINT uq_event_org_rsvp
      DO UPDATE SET confirmed_by = $3, updated_at = NOW()
    `,
    values: [eventId, orgId, userId],
  });

  return getRsvpCounts(eventId);
}

/**
 * Remove o RSVP de uma organização num evento.
 * Valida que o usuário é membro/admin/dono da org.
 */
async function removeOrgRsvp(eventId, orgId, userId) {
  const memberResult = await database.query({
    text: `
      SELECT 1 FROM org_members WHERE org_id = $1 AND member_id = $2 AND status = 'active'
      UNION
      SELECT 1 FROM organizations WHERE id = $1 AND owner_id = $2
    `,
    values: [orgId, userId],
  });
  if (!memberResult.rowCount) {
    throw new ForbiddenError({ message: "Você não faz parte deste estúdio." });
  }

  await database.query({
    text: `DELETE FROM event_org_rsvps WHERE event_id = $1 AND organization_id = $2`,
    values: [eventId, orgId],
  });

  return getRsvpCounts(eventId);
}

async function removeRsvp(eventId, userId) {
  await database.query({
    text: `DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2 AND instance_id IS NULL`,
    values: [eventId, userId],
  });
  return getRsvpCounts(eventId);
}

async function getRsvpCounts(eventId) {
  const result = await database.query({
    text: `
      SELECT
        COUNT(*) FILTER (WHERE status = 'going')     AS going,
        COUNT(*) FILTER (WHERE status = 'maybe')     AS maybe,
        COUNT(*) FILTER (WHERE status = 'not_going') AS not_going
      FROM event_rsvps
      WHERE event_id = $1 AND instance_id IS NULL
    `,
    values: [eventId],
  });
  return result.rows[0];
}

/* ================================================================
 * CONVITES (eventos privados)
 * ================================================================ */

async function invite(eventId, targetUserId, inviterUserId) {
  // Somente o organizador pode convidar
  const eventResult = await database.query({
    text: `SELECT created_by, visibility FROM events WHERE id = $1`,
    values: [eventId],
  });
  if (!eventResult.rowCount) throw new NotFoundError({ message: "Evento não encontrado." });

  const event = eventResult.rows[0];
  if (event.created_by !== inviterUserId) {
    throw new ForbiddenError({
      message: "Apenas o organizador pode convidar usuários.",
    });
  }

  await database.query({
    text: `
      INSERT INTO event_invitations (event_id, invited_user_id, invited_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, invited_user_id) DO NOTHING
    `,
    values: [eventId, targetUserId, inviterUserId],
  });
}

async function respondInvitation(eventId, userId, status) {
  const validStatuses = ["accepted", "declined"];
  if (!validStatuses.includes(status)) {
    throw new ValidationError({
      message: "Status inválido. Use: accepted ou declined.",
    });
  }

  const result = await database.query({
    text: `
      UPDATE event_invitations
      SET status = $3, updated_at = NOW()
      WHERE event_id = $1 AND invited_user_id = $2
      RETURNING id
    `,
    values: [eventId, userId, status],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Convite não encontrado." });
  }
}

/* ================================================================
 * POSTS DO EVENTO
 * ================================================================ */

async function getEventPosts(eventId, userId) {
  const result = await database.query({
    text: `
      SELECT
        p.id,
        p.content,
        p.img,
        p.created_at,
        pui.secure_url     AS post_img_url,
        u.username         AS author_username,
        u.avatar_image     AS author_avatar,
        uui.secure_url     AS author_avatar_url,
        COALESCE(lc.likes_count, 0) AS likes_count,
        (pl.post_id IS NOT NULL)    AS liked_by_user
      FROM posts p
      INNER JOIN users u ON u.id = p.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      LEFT JOIN uploaded_images pui ON pui.id = p.img
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS likes_count FROM post_likes WHERE post_id = p.id
      ) lc ON true
      LEFT JOIN LATERAL (
        SELECT 1, post_id FROM post_likes WHERE post_id = p.id AND user_id = $2 LIMIT 1
      ) pl ON true
      WHERE p.event_id = $1
      ORDER BY p.created_at DESC
    `,
    values: [eventId, userId ?? null],
  });
  return result.rows;
}

/* ================================================================
 * GERAÇÃO ESTENDIDA (para job periódico ou rota admin)
 * Gera instâncias futuras para eventos recorrentes que estão
 * chegando ao fim da janela pré-gerada.
 * ================================================================ */
async function extendInstances(eventId, windowEnd) {
  const eventResult = await database.query({
    text: `SELECT e.*, r.* FROM events e LEFT JOIN event_recurrence_rules r ON r.id = e.recurrence_rule_id WHERE e.id = $1`,
    values: [eventId],
  });

  if (!eventResult.rowCount) throw new NotFoundError({ message: "Evento não encontrado." });

  const row = eventResult.rows[0];
  if (!row.is_recurring || !row.recurrence_rule_id) return;

  // Última instância gerada
  const lastResult = await database.query({
    text: `SELECT starts_at FROM event_instances WHERE event_id = $1 ORDER BY starts_at DESC LIMIT 1`,
    values: [eventId],
  });
  const lastStart = lastResult.rowCount ? new Date(lastResult.rows[0].starts_at) : new Date(row.starts_at);

  const rule = {
    frequency: row.frequency,
    interval: row.interval,
    days_of_week: row.days_of_week,
    week_of_month: row.week_of_month,
    day_of_month: row.day_of_month,
    months_of_year: row.months_of_year,
    until_date: row.until_date,
    max_occurrences: row.max_occurrences,
  };

  // Gera a partir do dia civil seguinte ao da última instância, no calendário de
  // Brasília — `setUTCDate` sobre um instante é o mesmo erro de sempre: o "dia
  // seguinte" de um evento de dia inteiro (00:00 BRT) não é o dia UTC seguinte.
  const fromDate = eventInstantOf(shiftEventDays(eventCivilDate(lastStart), 1));

  // O `eventEnd` do par (início, término) precisa ser o término **relativo ao
  // novo início**, não a data do fim do evento: o motor usa o deslocamento em
  // dias entre os dois e o horário de parede de cada um. Passar o `ends_at` do
  // evento (que está lá atrás) gerava ocorrências terminando antes de começar.
  const originalSpanMs = new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime();
  const spanEnd = new Date(fromDate.getTime() + originalSpanMs);

  const newInstances = expandRecurrenceRule(rule, fromDate, spanEnd, windowEnd);

  if (newInstances.length) await insertInstances(eventId, newInstances);

  return newInstances.length;
}

/* ================================================================
 * BANNER DO EVENTO
 * ================================================================ */

async function setBannerImage(id, file, userId) {
  const ev = await findById(id, userId);
  if (ev.created_by !== userId) {
    throw new ForbiddenError({
      message: "Apenas o organizador pode editar este evento.",
    });
  }
  if (ev.banner_image_id) {
    try {
      await uploadedImages.deleteImage(ev.banner_image_id);
    } catch {
      // deletion of previous banner is best-effort; proceed regardless
    }
  }
  const imageData = await uploadedImages.uploadImage(file, `events/${id}`);
  await database.query({
    text: `UPDATE events SET banner_image_id = $2, banner_external_url = NULL, updated_at = NOW() WHERE id = $1`,
    values: [id, imageData.id],
  });
  return findById(id, userId);
}

async function setBannerExternalUrl(id, url, userId) {
  const ev = await findById(id, userId);
  if (ev.created_by !== userId) {
    throw new ForbiddenError({
      message: "Apenas o organizador pode editar este evento.",
    });
  }
  if (!url?.trim()) throw new ValidationError({ message: "URL da imagem inválida." });
  if (ev.banner_image_id) {
    try {
      await uploadedImages.deleteImage(ev.banner_image_id);
    } catch {
      // deletion of previous banner is best-effort; proceed regardless
    }
  }
  await database.query({
    text: `UPDATE events SET banner_image_id = NULL, banner_external_url = $2, updated_at = NOW() WHERE id = $1`,
    values: [id, url.trim()],
  });
  return findById(id, userId);
}

async function removeBanner(id, userId) {
  const ev = await findById(id, userId);
  if (ev.created_by !== userId) {
    throw new ForbiddenError({
      message: "Apenas o organizador pode editar este evento.",
    });
  }
  if (ev.banner_image_id) {
    try {
      await uploadedImages.deleteImage(ev.banner_image_id);
    } catch {
      // deletion of previous banner is best-effort; proceed regardless
    }
  }
  await database.query({
    text: `UPDATE events SET banner_image_id = NULL, banner_external_url = NULL, updated_at = NOW() WHERE id = $1`,
    values: [id],
  });
}

const event = {
  create,
  findById,
  findAll,
  findAllForSitemap,
  update,
  cancel,
  upsertRsvp,
  removeRsvp,
  upsertOrgRsvp,
  removeOrgRsvp,
  getRsvpCounts,
  invite,
  respondInvitation,
  getEventPosts,
  extendInstances,
  expandRecurrenceRule,
  setBannerImage,
  setBannerExternalUrl,
  removeBanner,
};

export default event;
