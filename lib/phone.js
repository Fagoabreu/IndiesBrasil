/**
 * lib/phone.js — Normalização e validação de telefone brasileiro.
 *
 * Por que existe: contato de telefone era texto livre. O usuário digitava
 * "(11) 99999-9999", "11999999999", "+55 11 99999 9999" ou qualquer coisa, e o
 * banco guardava aquilo como estava. O resultado era um contato que não vira
 * link (ninguém liga nem abre o WhatsApp) e, pior, um número inválido que só se
 * descobre na hora de usar.
 *
 * Aqui o valor é reduzido a dígitos e validado contra as regras reais da
 * numeração brasileira:
 *  - **DDD** precisa existir na lista oficial da Anatel — não basta ser 11–99;
 *    "20" e "36" parecem plausíveis e não são DDD nenhum. É o erro de digitação
 *    mais comum (trocar dois dígitos), e sem essa checagem ele passa.
 *  - **Fixo** tem 8 dígitos; **celular**, 9 e começa com 9. Um celular com 8
 *    dígitos é número antigo, anterior à adoção do nono dígito.
 */

/**
 * DDDs em uso no Brasil (Anatel).
 *
 * Agrupados por região para a leitura acompanhar o mapa — a ordem alfabética
 * de um array plano esconderia o padrão e dificultaria conferir contra a lista
 * oficial quando ela mudar.
 */
const VALID_AREA_CODES = new Set([
  // SP
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  // RJ / ES
  21, 22, 24, 27, 28,
  // MG
  31, 32, 33, 34, 35, 37, 38,
  // PR / SC
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  // RS
  51, 53, 54, 55,
  // DF / GO / TO / MT / MS / AC / RO
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  // BA / SE
  71, 73, 74, 75, 77, 79,
  // PE / AL / PB / RN
  81, 82, 83, 84, 87,
  // CE / PI / MA / PA / AM / RR / AP
  85, 86, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Comprimento do número nacional sem o DDD. */
const FIXED_LENGTH = 8;
const MOBILE_LENGTH = 9;

/** Teto do que aceitamos como entrada, antes de reduzir a dígitos. */
const MAX_INPUT_LENGTH = 40;

/**
 * Reduz a entrada a dígitos, removendo o código do país quando presente.
 *
 * O `55` inicial só é removido quando sobra um número nacional plausível
 * (10 ou 11 dígitos) — senão um DDD 55 (RS) com número curto seria mutilado.
 * @param {*} value
 * @returns {string}
 */
export function toDigits(value) {
  if (typeof value !== "string" || value.length > MAX_INPUT_LENGTH) return "";

  const digits = value.replace(/\D/g, "");

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Classifica um telefone brasileiro.
 *
 * @param {*} value — número digitado, com ou sem máscara, com ou sem +55
 * @returns {{ digits: string, areaCode: number, subscriber: string, kind: "mobile"|"fixed" } | null}
 *   `null` quando não é um telefone brasileiro válido.
 */
export function parseBrPhone(value) {
  const digits = toDigits(value);

  if (digits.length !== FIXED_LENGTH + 2 && digits.length !== MOBILE_LENGTH + 2) {
    return null;
  }

  const areaCode = Number(digits.slice(0, 2));
  if (!VALID_AREA_CODES.has(areaCode)) return null;

  const subscriber = digits.slice(2);

  // Fixo: 8 dígitos começando em 2–5 (1 e 0 não são usados como primeiro
  // dígito; 9 é celular).
  if (subscriber.length === FIXED_LENGTH) {
    if (!/^[2-5]/.test(subscriber)) return null;
    return { digits, areaCode, subscriber, kind: "fixed" };
  }

  // Celular: 9 dígitos e o primeiro é sempre 9 (regra do nono dígito).
  if (!/^9/.test(subscriber)) return null;
  return { digits, areaCode, subscriber, kind: "mobile" };
}

/**
 * Formata um telefone para leitura: `(11) 99999-9999` ou `(11) 9999-9999`.
 * @param {*} value
 * @returns {string} string vazia quando o número não é válido.
 */
export function formatBrPhone(value) {
  const parsed = parseBrPhone(value);
  if (!parsed) return "";

  const { areaCode, subscriber } = parsed;
  const cut = subscriber.length - 4;

  return `(${areaCode}) ${subscriber.slice(0, cut)}-${subscriber.slice(cut)}`;
}

/**
 * Normaliza um telefone para E.164 sem o `+` (ex.: `5511999999999`).
 *
 * É o formato que o `wa.me` exige, e o que o `tel:` aceita internacionalmente —
 * por isso os contatos de telefone são gravados assim, e não como o usuário
 * digitou.
 * @param {*} value
 * @returns {string} string vazia quando o número não é válido.
 */
export function toE164Br(value) {
  const parsed = parseBrPhone(value);
  return parsed ? `55${parsed.digits}` : "";
}
