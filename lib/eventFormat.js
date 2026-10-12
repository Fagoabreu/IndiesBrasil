/**
 * Data/hora dos eventos — conversão e formatação. Fonte única do fuso.
 *
 * Todo evento é exibido **e digitado** no horário de Brasília, a mesma decisão
 * tomada para reuniões (`lib/meetingFormat.js`). Antes a agenda agrupava o dia
 * em **UTC** e mostrava o horário no fuso do navegador: um evento às 21h em
 * Brasília é 00h do dia seguinte em UTC, então o selo de data mostrava um dia e
 * o horário ao lado mostrava outro. Fixar o fuso acaba com a discordância e
 * deixa a saída igual no servidor e no navegador (sem risco de mismatch de
 * hidratação).
 *
 * ## O contrato
 *
 * `starts_at`/`ends_at` são **instantes** (`timestamptz` no banco): guardam
 * quando o evento acontece, não o que está escrito na tela. Quem exibe converte
 * para Brasília (`eventDateParts`); quem grava converte na direção oposta
 * (`wallClockToInstant`).
 *
 * **Dia inteiro não tem hora**, então o dia escolhido vira o instante `00:00 de
 * Brasília` (03:00Z) e o término vira `00:00 de Brasília do dia SEGUINTE` ao
 * último dia escolhido — fim **exclusivo**, como no RFC 5545 (`DTEND` de valor
 * `DATE` é exclusivo) e na API do Google Calendar (`end.date`). Um evento de um
 * único dia vira o intervalo de 24h daquele dia, que é o que faz a busca do mês
 * (`ei.starts_at < to AND ei.ends_at > from`) incluí-lo: com início e término
 * iguais a duração é zero e o evento cai fora da própria lista.
 *
 * Era aqui que o dia anterior nascia. O valor de `<input type="date">`
 * ("2026-10-12") ia direto para `new Date(...)`, e a especificação manda ler
 * string só de data como **meia-noite UTC** — 21h do dia anterior em Brasília,
 * o dia que aparecia no card da agenda e da home.
 */

export const EVENT_TIME_ZONE = "America/Sao_Paulo";

/** `0` = Dom, como `Date#getDay` e como `days_of_week` da recorrência. */
export const EVENT_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EVENT_DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: EVENT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const CIVIL_FORMATTERS = new Map();

/**
 * Campos de hora de parede de um instante, num formatador por fuso reusado —
 * construir `Intl.DateTimeFormat` é caro e estas funções rodam por item de lista.
 *
 * `hour12: false` com `hour: "2-digit"` pode devolver "24" à meia-noite em
 * algumas versões do ICU, então quem lê o campo aplica `% 24`.
 */
function civilFormatter(zone) {
  let formatter = CIVIL_FORMATTERS.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    CIVIL_FORMATTERS.set(zone, formatter);
  }
  return formatter;
}

export const EVENT_MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const EVENT_MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

/**
 * Deslocamento do fuso (ms) no instante dado: o quanto somar a um horário de
 * parede para chegar ao instante.
 *
 * Calculado, não fixado em `-03:00`: o Brasil não tem horário de verão desde
 * 2019, mas o número fixo faria qualquer data histórica (e uma volta do horário
 * de verão) mentir por uma hora, sem nada avisando.
 */
function zoneOffsetMs(instant, zone) {
  const parts = {};
  for (const part of civilFormatter(zone).formatToParts(instant)) parts[part.type] = part.value;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  // O instante é truncado ao segundo: os campos lidos não têm milissegundos, e
  // sem isso o resto entra no deslocamento.
  return asUtc - Math.trunc(instant.getTime() / 1000) * 1000;
}

/**
 * Data/hora de parede de um instante, no fuso pedido.
 *
 * `month` é **1-indexado** (janeiro = 1): é calendário civil, não índice de
 * array. Para indexar `EVENT_MONTHS_SHORT` use `eventDateParts`, que devolve o
 * mês 0-indexado como `Date#getMonth`.
 *
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, weekday: number }}
 */
export function eventCivilDate(value, zone = EVENT_TIME_ZONE) {
  const parts = {};
  for (const part of civilFormatter(zone).formatToParts(new Date(value))) parts[part.type] = part.value;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  return {
    year,
    month,
    day,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/**
 * Instante de um horário de parede. Só as chaves presentes entram; hora ausente
 * é meia-noite.
 */
export function eventInstantOf(civil, zone = EVENT_TIME_ZONE) {
  const { year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 } = civil;
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  // Duas passagens porque o deslocamento depende do instante: o primeiro palpite
  // pode ter caído do outro lado de uma mudança de offset. Mesmo algoritmo de
  // `luxon`/`date-fns-tz` — `Temporal` resolveria nativamente, mas ainda não tem
  // suporte uniforme para ser a base disto.
  const firstGuess = wallClock - zoneOffsetMs(new Date(wallClock), zone);
  return new Date(wallClock - zoneOffsetMs(new Date(firstGuess), zone));
}

/** Mesmo dia civil deslocado N dias — aritmética de calendário, sem fuso. */
export function shiftEventDays(civil, days) {
  const shifted = new Date(Date.UTC(civil.year, civil.month - 1, civil.day + days));
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();

  return { ...civil, year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** Diferença em dias civis entre duas datas do calendário (pode ser negativa). */
export function eventCivilDayDiff(from, to) {
  return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86400000);
}

/** `YYYY-MM-DD` do valor de `<input type="date">` e do `datetime-local`. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Valor de input (`datetime-local` ou `date`) → instante, lido como hora de
 * Brasília.
 *
 * As expressões são **ancoradas** de propósito: `"2026-10-12T20:00:30Z"` é um
 * instante já resolvido e não pode ser reinterpretado como hora de parede. Date,
 * número e string com offset passam direto — é o que faz a função aceitar tanto
 * o que o formulário digita quanto o que a API já entrega.
 */
export function wallClockToInstant(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "number") return new Date(value);

  const text = String(value ?? "").trim();

  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) {
    return eventInstantOf({ year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]) });
  }

  const local = DATE_TIME_LOCAL.exec(text);
  if (local) {
    return eventInstantOf({
      year: Number(local[1]),
      month: Number(local[2]),
      day: Number(local[3]),
      hour: Number(local[4]),
      minute: Number(local[5]),
    });
  }

  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Data inválida: ${text}`);
  return instant;
}

/**
 * Instante → valor de `<input>`, no fuso de exibição.
 *
 * `dateOnly` devolve `YYYY-MM-DD` (o input de dia inteiro); sem ele, devolve
 * `YYYY-MM-DDTHH:mm` no formato do `datetime-local`.
 */
export function instantToWallClock(value, { dateOnly = false } = {}) {
  if (!value) return "";

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";

  const { year, month, day, hour, minute } = eventCivilDate(instant);
  const date = `${year}-${pad2(month)}-${pad2(day)}`;

  return dateOnly ? date : `${date}T${pad2(hour)}:${pad2(minute)}`;
}

/** "<agora + offsetMinutos>" em Brasília, no formato de `datetime-local`. */
export function eventDateTimeFromNow(offsetMinutes) {
  return instantToWallClock(Date.now() + offsetMinutes * 60 * 1000);
}

/**
 * Faixa de um mês do calendário de Brasília.
 *
 * `to` é **exclusivo** (00:00 do dia 1º seguinte): a busca da agenda pergunta
 * `ei.starts_at < to AND ei.ends_at > from`, então o intervalo precisa ser
 * fechado à esquerda e aberto à direita — e é isso que faz o evento de dia
 * inteiro do dia 1º entrar na lista do próprio mês. Montar a faixa com
 * `new Date(year, month, ...)` a calcularia no fuso do navegador enquanto o card
 * exibe em Brasília: a lista e a data mostrada discordavam.
 *
 * @param {number} year
 * @param {number} month — 0-indexado, como `Date#getMonth`.
 * @returns {{ from: Date, to: Date }}
 */
export function brasiliaMonthRange(year, month) {
  return {
    from: eventInstantOf({ year, month: month + 1, day: 1 }),
    to: eventInstantOf({ year, month: month + 2, day: 1 }),
  };
}

/**
 * Partes de data/hora de um evento, já no fuso de exibição.
 *
 * `month` é 0-indexado, como `Date#getMonth`, para indexar as listas de meses.
 * Chame uma vez e reuse — cada chamada formata a data inteira.
 *
 * @returns {{ weekday: number, day: number, month: number, year: number, time: string }}
 */
export function eventDateParts(value) {
  const parts = EVENT_DATE_TIME.formatToParts(new Date(value));
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";

  const day = Number(read("day"));
  const month = Number(read("month")) - 1;
  const year = Number(read("year"));

  return {
    weekday: new Date(Date.UTC(year, month, day)).getUTCDay(),
    day,
    month,
    year,
    time: `${read("hour")}:${read("minute")}`,
  };
}

/** "Seg, 12 de out de 2026" — e " às 20:00" quando o evento tem hora. */
export function formatEventDate(value, { allDay = false } = {}) {
  const { weekday, day, month, year, time } = eventDateParts(value);
  const date = `${EVENT_WEEKDAYS[weekday]}, ${day} de ${EVENT_MONTHS_SHORT[month]} de ${year}`;

  return allDay ? date : `${date} às ${time}`;
}

/** "Seg, 12/out/2026" — o formato curto da lista de ocorrências. */
export function formatEventShortDate(value) {
  const { weekday, day, month, year } = eventDateParts(value);
  return `${EVENT_WEEKDAYS[weekday]}, ${day}/${EVENT_MONTHS_SHORT[month]}/${year}`;
}

/**
 * Faixa de horário do evento.
 *
 * No mesmo dia mostra só os horários ("20:00 – 22:00"); atravessando dias,
 * mostra as datas ("3/out – 5/out"), porque só o horário não diria nada.
 */
export function formatEventTimeRange(startsAt, endsAt) {
  const start = eventDateParts(startsAt);
  const end = eventDateParts(endsAt);

  const sameDay = start.day === end.day && start.month === end.month && start.year === end.year;
  if (sameDay) return `${start.time} – ${end.time}`;

  return `${start.day}/${EVENT_MONTHS_SHORT[start.month]} – ${end.day}/${EVENT_MONTHS_SHORT[end.month]}`;
}

/**
 * Eventos em ordem cronológica.
 *
 * A API ordena por id da instância (o `DISTINCT ON (ei.id)`), não por data —
 * quem exibe em lista precisa ordenar por conta própria.
 */
export function sortEventsByStart(events) {
  return [...events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

/* ================================================================
 * DIA INTEIRO
 *
 * O término é **exclusivo** (ver o cabeçalho). Estas funções são a única
 * tradução entre essa convenção e o dia que aparece na tela ou no input — a
 * regra repetida em cada tela é como as duas pontas divergem.
 * ================================================================ */

/** `true` para `YYYY-MM-DD` — a forma que o input de dia inteiro entrega. */
function isDateOnlyValue(value) {
  return typeof value === "string" && DATE_ONLY.test(value.trim());
}

/** Meia-noite de Brasília do dia civil de `value` — o início de dia inteiro. */
export function allDayStartInstant(value) {
  const { year, month, day } = eventCivilDate(wallClockToInstant(value));
  return eventInstantOf({ year, month, day });
}

/**
 * Fronteira de término do intervalo de dia inteiro (exclusiva).
 *
 * Aceita as **duas** formas do mesmo dia, e distingui-las é o essencial: o input
 * de dia inteiro manda o dia escolhido (`"2026-10-14"`), que é o dia *incluído*
 * — foi o que o usuário leu na tela —, enquanto a API devolve o instante do
 * término, que já é a fronteira seguinte (`"2026-10-15T03:00:00.000Z"`). Ler a
 * primeira como se fosse a segunda encurtaria o evento em um dia.
 *
 * Idempotente nas duas formas, que é o que faz o `PATCH` (que reenvia o que leu)
 * não andar sozinho.
 */
function allDayEndBoundary(value) {
  const { year, month, day } = isDateOnlyValue(value)
    ? eventCivilDate(allDayStartInstant(value))
    : eventCivilDate(new Date(wallClockToInstant(value).getTime() - 1));

  // Só ano/mês/dia: o dia seguinte começa à meia-noite, não às 23:59:59 do dia
  // em questão (o civil acima carrega esse horário).
  return eventInstantOf(shiftEventDays({ year, month, day }, 1));
}

/** Instante do último milissegundo **incluído** — o que a tela pode exibir. */
export function allDayLastInstant(value) {
  return new Date(allDayEndBoundary(value).getTime() - 1);
}

/** `YYYY-MM-DD` do último dia incluído — o que o input de término mostra. */
export function allDayEndDate(endsAt) {
  return instantToWallClock(allDayLastInstant(endsAt), { dateOnly: true });
}

/** Meia-noite de Brasília do dia seguinte ao último dia escolhido. */
export function allDayEndInstant(value) {
  return allDayEndBoundary(value);
}
