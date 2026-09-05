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
 * Data/hora curta em pt-BR ("12/03/2025 14:30").
 * @param {string|Date} value
 * @returns {string}
 */
export function formatDateTimeBR(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} ${time}`;
}

/**
 * Faixa de horário legível: "12/03/2025, 14:30 → 15:30".
 * @param {string|Date} startsAt
 * @param {string|Date} endsAt
 * @returns {string}
 */
export function formatMeetingRange(startsAt, endsAt) {
  if (!startsAt || !endsAt) return "";
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();

  const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `${dayFormatter.format(start)}, ${timeFormatter.format(start)} → ${timeFormatter.format(end)}`;
  }
  return `${formatDateTimeBR(startsAt)} → ${formatDateTimeBR(endsAt)}`;
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
