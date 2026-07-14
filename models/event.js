import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import addressModel from "@/models/address";

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

/** Preserva horário de `ref` na data de `dateOnly`. */
function withTime(dateOnly, ref) {
  return new Date(
    Date.UTC(
      dateOnly.getUTCFullYear(),
      dateOnly.getUTCMonth(),
      dateOnly.getUTCDate(),
      ref.getUTCHours(),
      ref.getUTCMinutes(),
      0,
      0,
    ),
  );
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
    const result = new Date(
      Date.UTC(year, month, firstOccurrence.getUTCDate() + 7 * (week - 1)),
    );
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
 * ================================================================ */
function makeInstancePusher(eventStart, eventEnd, until, maxCount) {
  const duration = eventEnd.getTime() - eventStart.getTime();
  const instances = [];
  function push(d) {
    if (d >= eventStart && d <= until && instances.length < maxCount) {
      instances.push({
        starts_at: new Date(d),
        ends_at: new Date(d.getTime() + duration),
      });
    }
  }
  return { push, instances };
}

function expandDaily(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  let remaining = maxCount;
  let currentDate = new Date(eventStart);
  while (currentDate <= until && remaining > 0) {
    push(new Date(currentDate));
    currentDate = new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate() + interval,
      ),
    );
    remaining -= 1;
  }
}

function expandWeekly(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  const days =
    rule.days_of_week?.length > 0
      ? [...rule.days_of_week].sort((a, b) => a - b)
      : [eventStart.getUTCDay()];
  const startDow = eventStart.getUTCDay();
  let weekSunday = new Date(
    Date.UTC(
      eventStart.getUTCFullYear(),
      eventStart.getUTCMonth(),
      eventStart.getUTCDate() - startDow,
    ),
  );
  let remaining = maxCount;
  while (weekSunday <= until && remaining > 0) {
    for (const day of days) {
      if (remaining <= 0) break;
      push(
        withTime(
          new Date(
            Date.UTC(
              weekSunday.getUTCFullYear(),
              weekSunday.getUTCMonth(),
              weekSunday.getUTCDate() + day,
            ),
          ),
          eventStart,
        ),
      );
      remaining -= 1;
    }
    weekSunday = new Date(
      Date.UTC(
        weekSunday.getUTCFullYear(),
        weekSunday.getUTCMonth(),
        weekSunday.getUTCDate() + 7 * interval,
      ),
    );
  }
}

function expandMonthly(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  let year = eventStart.getUTCFullYear();
  let month = eventStart.getUTCMonth();
  let remaining = maxCount;
  while (new Date(Date.UTC(year, month, 1)) <= until && remaining > 0) {
    let d = null;
    if (rule.week_of_month != null && rule.days_of_week?.length > 0) {
      d = getNthWeekdayOfMonth(
        year,
        month,
        rule.days_of_week[0],
        rule.week_of_month,
      );
    } else {
      const dom = rule.day_of_month ?? eventStart.getUTCDate();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      d = new Date(Date.UTC(year, month, Math.min(dom, lastDay)));
    }
    if (d) {
      push(withTime(d, eventStart));
      remaining -= 1;
    }
    month += interval;
    if (month > 11) {
      year += Math.floor(month / 12);
      month = month % 12;
    }
  }
}

function expandYearly(rule, eventStart, until, maxCount, push) {
  const interval = rule.interval || 1;
  const months =
    rule.months_of_year?.length > 0
      ? rule.months_of_year.map((m) => m - 1)
      : [eventStart.getUTCMonth()];
  let year = eventStart.getUTCFullYear();
  let remaining = maxCount;
  while (year <= until.getUTCFullYear() + 1 && remaining > 0) {
    for (const m of months) {
      if (remaining <= 0) break;
      push(
        withTime(
          new Date(Date.UTC(year, m, eventStart.getUTCDate())),
          eventStart,
        ),
      );
      remaining -= 1;
    }
    year += interval;
  }
}

export function expandRecurrenceRule(rule, eventStart, eventEnd, windowEnd) {
  const ruleUntil = rule.until_date ? new Date(rule.until_date) : null;
  const until = ruleUntil && ruleUntil < windowEnd ? ruleUntil : windowEnd;
  const maxCount = rule.max_occurrences ?? 500;
  const { push, instances } = makeInstancePusher(
    eventStart,
    eventEnd,
    until,
    maxCount,
  );

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

  const placeholders = instanceDates
    .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
    .join(", ");
  const values = [
    eventId,
    ...instanceDates.flatMap((d) => [d.starts_at, d.ends_at]),
  ];

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

/* ================================================================
 * API PÚBLICA DO MODEL
 * ================================================================ */

/**
 * Cria um evento e suas instâncias iniciais.
 * @param {object} data - Campos do evento + opcional `recurrence_rule`
 * @param {string} userId - UUID do usuário criador
 */
async function create(data, userId) {
  if (!data.title?.trim())
    throw new ValidationError({ message: "Título é obrigatório." });
  if (!data.starts_at)
    throw new ValidationError({ message: "Data de início é obrigatória." });
  if (!data.ends_at)
    throw new ValidationError({ message: "Data de término é obrigatória." });

  const startsAt = new Date(data.starts_at);
  const endsAt = new Date(data.ends_at);

  if (endsAt < startsAt) {
    throw new ValidationError({
      message: "Data de término não pode ser anterior à de início.",
    });
  }

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
        address_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
  const result = await database.query({
    text: `
      ${BASE_EVENT_QUERY}
      WHERE e.id = $1
    `,
    values: [id],
  });

  if (!result.rowCount) {
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

  // Condições de visibilidade
  // - public: todos
  // - members: usuário autenticado com create:session
  // - private: somente criador ou convidado aceito
  const values = [fromDate, toDate, status];
  let visibilityClause;

  if (userId) {
    values.push(userId);
    const userIdx = values.length; // $4
    visibilityClause = `
      (
        e.visibility IN ('public', 'members')
        OR e.created_by = $${userIdx}
        OR EXISTS (
          SELECT 1 FROM event_invitations ei2
          WHERE ei2.event_id = e.id
            AND ei2.invited_user_id = $${userIdx}
            AND ei2.status IN ('pending', 'accepted')
        )
      )
    `;
  } else {
    visibilityClause = `e.visibility = 'public'`;
  }

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
    "location_name",
    "location_url",
    "is_online",
    "online_url",
    "is_all_day",
    "banner_image_id",
  ];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    if (key in data) {
      values.push(data[key]);
      sets.push(`${key} = $${values.length}`);
    }
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

  return findById(id, userId);
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
  if (!eventResult.rowCount)
    throw new NotFoundError({ message: "Evento não encontrado." });

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
  if (!eventResult.rowCount)
    throw new NotFoundError({ message: "Evento não encontrado." });
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
  if (!eventResult.rowCount)
    throw new NotFoundError({ message: "Evento não encontrado." });

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

  if (!eventResult.rowCount)
    throw new NotFoundError({ message: "Evento não encontrado." });

  const row = eventResult.rows[0];
  if (!row.is_recurring || !row.recurrence_rule_id) return;

  // Última instância gerada
  const lastResult = await database.query({
    text: `SELECT starts_at FROM event_instances WHERE event_id = $1 ORDER BY starts_at DESC LIMIT 1`,
    values: [eventId],
  });
  const lastStart = lastResult.rowCount
    ? new Date(lastResult.rows[0].starts_at)
    : new Date(row.starts_at);

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

  // Gera a partir do próximo dia após a última instância
  const fromDate = new Date(lastStart);
  fromDate.setUTCDate(fromDate.getUTCDate() + 1);

  const newInstances = expandRecurrenceRule(
    rule,
    fromDate,
    new Date(row.ends_at),
    windowEnd,
  );

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
  if (!url?.trim())
    throw new ValidationError({ message: "URL da imagem inválida." });
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
