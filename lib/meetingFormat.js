/**
 * lib/meetingFormat.js — Helpers de formatação e fase exibida de reuniões.
 *
 * O status gravado no banco fica em 'scheduled' até transições manuais; a UI
 * deriva a fase real a partir da janela de horário (starts_at/ends_at), como
 * faz models/meeting.assertCanJoin.
 */

export const MEETING_PHASE_LABELS = {
  scheduled: "Agendada",
  live: "Ao vivo",
  ended: "Encerrada",
  cancelled: "Cancelada",
};

/**
 * Reuniões são sempre exibidas no horário de Brasília (America/Sao_Paulo).
 *
 * O banco guarda timestamptz (instante absoluto) e a página de convidado é
 * renderizada no servidor (SSR, container em UTC) e hidratada no navegador.
 * Fixar o fuso aqui mantém o HTML inicial e o cliente idênticos (sem mismatch
 * de hidratação) e deixa a saída determinística em qualquer ambiente/runner.
 */
const MEETING_TIME_ZONE = "America/Sao_Paulo";

/** Quebra data/hora de um Date no fuso fixo de exibição de reuniões. */
function getMeetingDateParts(value) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: MEETING_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: read("day"),
    month: read("month"),
    year: read("year"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/** Monta "12/03/2025 14:30" a partir das partes já extraídas. */
function formatPartsDateTime({ day, month, year, hour, minute }) {
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/**
 * Converte um Date/string ISO para o valor de um input datetime-local
 * (formato "YYYY-MM-DDTHH:mm" no fuso local do navegador).
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function toLocalDatetimeValue(date) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/**
 * Data/hora curta em pt-BR ("12/03/2025 14:30"), sempre em horário de
 * Brasília — ver constante MEETING_TIME_ZONE.
 * @param {string|Date} value
 * @returns {string}
 */
export function formatDateTimeBR(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatPartsDateTime(getMeetingDateParts(d));
}

/**
 * Faixa de horário legível: "12/03/2025, 14:30 → 15:30". Datas e o teste de
 * "mesmo dia" usam o fuso fixo de Brasília (MEETING_TIME_ZONE).
 * @param {string|Date} startsAt
 * @param {string|Date} endsAt
 * @returns {string}
 */
export function formatMeetingRange(startsAt, endsAt) {
  if (!startsAt || !endsAt) return "";
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const startParts = getMeetingDateParts(start);
  const endParts = getMeetingDateParts(end);

  const sameDay = startParts.year === endParts.year && startParts.month === endParts.month && startParts.day === endParts.day;

  if (sameDay) {
    return `${startParts.day}/${startParts.month}/${startParts.year}, ${startParts.hour}:${startParts.minute} → ${endParts.hour}:${endParts.minute}`;
  }
  return `${formatPartsDateTime(startParts)} → ${formatPartsDateTime(endParts)}`;
}

/**
 * Fase exibida de uma reunião com base no horário atual.
 * - cancelled: reunião cancelada (status no banco).
 * - ended: status 'ended' ou término já passou.
 * - live: janela [starts_at, ends_at) em andamento.
 * - scheduled: ainda não começou.
 * @param {{ status?: string, starts_at: string|Date, ends_at: string|Date }} meeting
 * @param {number} [nowMs]
 * @returns {"scheduled"|"live"|"ended"|"cancelled"}
 */
export function getMeetingPhase(meeting, nowMs = Date.now()) {
  if (!meeting) return "cancelled";
  if (meeting.status === "cancelled") return "cancelled";
  if (meeting.status === "ended") return "ended";

  const startsAt = new Date(meeting.starts_at).getTime();
  const endsAt = new Date(meeting.ends_at).getTime();

  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return "cancelled";
  if (nowMs >= endsAt) return "ended";
  if (nowMs >= startsAt) return "live";
  return "scheduled";
}

/** Label em pt-BR da fase da reunião. */
export function getMeetingPhaseLabel(meeting, nowMs) {
  return MEETING_PHASE_LABELS[getMeetingPhase(meeting, nowMs)] || "Reunião";
}
