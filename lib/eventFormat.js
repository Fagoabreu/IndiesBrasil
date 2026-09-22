/**
 * Formatação de data/hora dos eventos — card, agenda e home.
 *
 * Todo evento é exibido no **horário de Brasília**, a mesma decisão tomada para
 * reuniões (`lib/meetingFormat.js`). Antes a agenda agrupava o dia em **UTC** e
 * mostrava o horário no fuso do navegador: um evento às 21h em Brasília é
 * 00h do dia seguinte em UTC, então o selo de data mostrava um dia e o horário
 * ao lado mostrava outro. Fixar o fuso acaba com a discordância e deixa a saída
 * igual no servidor e no navegador (sem risco de mismatch de hidratação).
 */

const EVENT_TIME_ZONE = "America/Sao_Paulo";

const EVENT_DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: EVENT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

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

/**
 * Partes de data/hora de um evento, já no fuso de exibição.
 *
 * `month` é 0-indexado, como `Date#getMonth`, para indexar as listas de meses.
 * Chame uma vez e reuse — cada chamada formata a data inteira.
 *
 * @returns {{ day: number, month: number, year: number, time: string }}
 */
export function eventDateParts(value) {
  const parts = EVENT_DATE_TIME.formatToParts(new Date(value));
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: Number(read("day")),
    month: Number(read("month")) - 1,
    year: Number(read("year")),
    time: `${read("hour")}:${read("minute")}`,
  };
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
