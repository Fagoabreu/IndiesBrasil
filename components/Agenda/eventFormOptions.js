/**
 * Constantes e helpers compartilhados entre criação e edição de evento.
 *
 * Os dois formulários eram cópias um do outro (≈40% das linhas idênticas), e
 * as cópias já haviam divergido: `editar.js` usava `styles.hint` de uma classe
 * que só existia no CSS da criação. Manter as opções e a montagem do payload
 * num só lugar evita esse tipo de deriva silenciosa.
 *
 * As opções de **tipo de evento** saíram daqui para `lib/event-types.js`: elas
 * não são vocabulário só do formulário, são o rótulo e a cor que a agenda, a
 * página do evento e o card de Open Graph também exibem. O `EventForm` importa
 * direto de lá — sem re-export aqui, para não haver dois caminhos até a mesma
 * constante.
 */

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Público — visível para todos" },
  { value: "members", label: "Membros — apenas usuários cadastrados" },
  { value: "private", label: "Privado — apenas convidados" },
];

export const FREQUENCIES = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

export const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

/** ISO → valor de <input type="datetime-local"> (YYYY-MM-DDTHH:mm, hora local). */
export function toDatetimeLocal(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

/** ISO → valor de <input type="date"> (YYYY-MM-DD). */
export function toDateOnly(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toISOString().slice(0, 10);
}

/** "<agora + offsetMinutos>" no formato de datetime-local — usado como padrão na criação. */
export function localDatetimeFromNow(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function emptyAddress() {
  return {
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
    country: "Brasil",
  };
}

/** Valores iniciais de um evento novo. */
export function emptyEventValues() {
  return {
    title: "",
    description: "",
    eventType: "general",
    visibility: "public",
    startsAt: localDatetimeFromNow(60),
    endsAt: localDatetimeFromNow(180),
    isAllDay: false,
    isOnline: false,
    onlineUrl: "",
    locationName: "",
    locationUrl: "",
    ticketUrl: "",
    address: emptyAddress(),
    isRecurring: false,
    frequency: "weekly",
    interval: 1,
    daysOfWeek: [],
    untilDate: "",
  };
}

/** Evento vindo da API → valores do formulário. */
export function eventValuesFromApi(ev) {
  return {
    title: ev.title || "",
    description: ev.description || "",
    eventType: ev.event_type || "general",
    visibility: ev.visibility || "public",
    startsAt: ev.is_all_day ? toDateOnly(ev.starts_at) : toDatetimeLocal(ev.starts_at),
    endsAt: ev.is_all_day ? toDateOnly(ev.ends_at) : toDatetimeLocal(ev.ends_at),
    isAllDay: ev.is_all_day || false,
    isOnline: ev.is_online || false,
    onlineUrl: ev.online_url || "",
    locationName: ev.location_name || "",
    locationUrl: ev.location_url || "",
    ticketUrl: ev.ticket_url || "",
    address: ev.address || emptyAddress(),
    // Recorrência não é editável nesta tela — mantida para o payload não
    // reenviar um valor diferente do que está salvo.
    isRecurring: ev.is_recurring || false,
    frequency: "weekly",
    interval: 1,
    daysOfWeek: [],
    untilDate: "",
  };
}

/** Mensagem de validação, ou null quando o evento pode ser salvo. */
export function validateEvent(values) {
  if (!values.title.trim()) return "O título é obrigatório.";

  const starts = new Date(values.startsAt);
  const ends = new Date(values.endsAt);
  const invalidRange = values.isAllDay ? ends < starts : ends <= starts;
  if (invalidRange) return "A data de término deve ser posterior à data de início.";

  return null;
}

/** Texto aparado, ou null quando vazio. */
function trimmedOrNull(value) {
  return value.trim() || null;
}

/**
 * Endereço só faz sentido em evento presencial com cidade preenchida.
 *
 * O valor de "vazio" muda com o modo: na criação o evento ainda não existe e
 * `undefined` significa "não enviar"; na edição `null` significa "limpar".
 */
function buildAddress(values, mode) {
  if (values.isOnline || !values.address.city) {
    return mode === "edit" ? null : undefined;
  }
  return values.address;
}

function buildRecurrenceRule(values) {
  const rule = {
    frequency: values.frequency,
    interval: Number(values.interval) || 1,
  };

  if (values.frequency === "weekly" && values.daysOfWeek.length > 0) {
    rule.days_of_week = values.daysOfWeek;
  }
  if (values.untilDate) {
    rule.until_date = values.untilDate;
  }

  return rule;
}

/**
 * Valores do formulário → corpo da requisição.
 *
 * `mode` muda só o tratamento do endereço (ver `buildAddress`) e se a
 * recorrência entra ou não: ela é editável apenas na criação.
 */
export function buildEventPayload(values, { mode }) {
  const payload = {
    title: values.title.trim(),
    description: values.description.trim() || null,
    event_type: values.eventType,
    visibility: values.visibility,
    starts_at: new Date(values.startsAt).toISOString(),
    ends_at: new Date(values.endsAt).toISOString(),
    is_all_day: values.isAllDay,
    is_online: values.isOnline,
    online_url: values.isOnline ? trimmedOrNull(values.onlineUrl) : null,
    location_name: values.isOnline ? null : trimmedOrNull(values.locationName),
    location_url: values.isOnline ? null : trimmedOrNull(values.locationUrl),
    ticket_url: trimmedOrNull(values.ticketUrl),
    address: buildAddress(values, mode),
  };

  if (mode === "create") {
    payload.is_recurring = values.isRecurring;
    if (values.isRecurring) {
      payload.recurrence_rule = buildRecurrenceRule(values);
    }
  }

  return payload;
}
