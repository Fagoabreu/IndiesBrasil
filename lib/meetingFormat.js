/**
 * lib/meetingFormat.js — Helpers de formatação e fase exibida de reuniões.
 *
 * O status gravado no banco fica em 'scheduled' até transições manuais; a UI
 * deriva a fase real a partir da janela de horário (starts_at/ends_at), como
 * faz models/meeting.assertCanJoin.
 */

import { instantToWallClock, wallClockToInstant } from "@/lib/eventFormat";
import { SITE_URL } from "@/lib/seo";

export const MEETING_PHASE_LABELS = {
  scheduled: "Agendada",
  live: "Ao vivo",
  ended: "Encerrada",
  cancelled: "Cancelada",
};

/**
 * URL pública da página de convidado de uma reunião.
 *
 * Usada como destino do botão "sair" do cliente do Galene (`?back=`), porque o
 * cliente roda em outro domínio (meet.…): ele precisa saber para onde voltar na
 * plataforma, e essa informação não pode ser deduzida de lá.
 * @param {string} meetingId
 * @returns {string}
 */
export function meetingPageUrl(meetingId) {
  return `${SITE_URL}/reunioes/${meetingId}`;
}

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
 * Instante → valor de `<input type="datetime-local">` no fuso de reuniões.
 *
 * Substitui a versão que usava `getTimezoneOffset()` do navegador: a lista de
 * reuniões exibe em Brasília (`MEETING_TIME_ZONE`), então o formulário precisa
 * digitar no mesmo fuso — senão quem está fora do BRT agenda um instante
 * diferente do que leu na tela.
 *
 * @param {Date|string|number} [value]
 * @returns {string} "YYYY-MM-DDTHH:mm" ou "" se inválido
 */
export function toMeetingInputValue(value) {
  return instantToWallClock(value, { zone: MEETING_TIME_ZONE });
}

/**
 * Valor de `<input type="datetime-local">` → instante, **lido em Brasília**.
 *
 * `new Date(valor)` interpretaria no fuso do navegador e salvaria outro
 * instante; aqui a conversão usa o mesmo fuso da exibição.
 *
 * @param {string} value
 * @returns {Date}
 */
export function meetingInputToInstant(value) {
  return wallClockToInstant(value, MEETING_TIME_ZONE);
}

/**
 * Valores iniciais do formulário de reunião: **agora** como início e +1h como
 * término.
 *
 * Calculado quando o formulário abre (`useState(() => …)`), nunca no escopo do
 * módulo: a página pode ficar aberta por horas, e a constante de módulo nascia
 * com o `Date.now()` do carregamento — o campo aparecia no passado. O `+1h` do
 * início (que existia antes) fazia a pessoa achar que o horário estava errado.
 *
 * @param {number} [nowMs]
 * @returns {{ startsAt: string, endsAt: string }} valores prontos para os inputs
 */
export function defaultMeetingWindow(nowMs = Date.now()) {
  return {
    startsAt: toMeetingInputValue(nowMs),
    endsAt: toMeetingInputValue(nowMs + 60 * 60 * 1000),
  };
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
