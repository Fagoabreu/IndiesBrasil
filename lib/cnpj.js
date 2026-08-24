/**
 * Valida um CNPJ pelo algoritmo oficial de dígitos verificadores.
 *
 * Suporta tanto o formato numérico tradicional quanto o novo CNPJ
 * alfanumérico (em vigor desde julho/2026). Neste último, os 12 primeiros
 * caracteres podem conter letras de A a Z e os 2 últimos (dígitos
 * verificadores) permanecem numéricos.
 *
 * No cálculo, o valor de cada caractere é dado pelo código ASCII subtraído
 * de 48 — assim, '0' vale 0, '9' vale 9, 'A' vale 17, 'B' vale 18, etc.
 *
 * Aceita CNPJ com ou sem máscara (pontos, barra e hífen são ignorados) e
 * letras maiúsculas ou minúsculas (normalizadas para maiúsculas).
 *
 * @param {string} cnpj — CNPJ a validar (ex: "11.222.333/0001-81" ou "12.ABC.345/01DE-35")
 * @returns {boolean} true se o CNPJ é válido.
 */
export function isValidCnpj(cnpj) {
  // Remove a máscara, mantendo apenas caracteres alfanuméricos e normaliza para maiúsculas.
  const digits = String(cnpj || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (digits.length !== 14) return false;

  // Os 12 primeiros caracteres podem ser alfanuméricos (A-Z e 0-9).
  if (!/^[A-Z0-9]{12}$/.test(digits.slice(0, 12))) return false;

  // Os 2 últimos caracteres (dígitos verificadores) são sempre numéricos.
  if (!/^\d{2}$/.test(digits.slice(12))) return false;

  // Rejeita sequências de caracteres repetidos (ex: 00000000000000, AAAAAAAAAAAAAA).
  if (/^(.)\1{13}$/.test(digits)) return false;

  const firstCheck = calculateCheckDigit(digits.slice(0, 12));
  if (firstCheck !== Number(digits[12])) return false;

  const secondCheck = calculateCheckDigit(digits.slice(0, 13));
  if (secondCheck !== Number(digits[13])) return false;

  return true;
}

function calculateCheckDigit(base) {
  const size = base.length;
  const weights = size === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < size; i++) {
    sum += characterValue(base[i]) * weights[i];
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valor de um caractere alfanumérico no cálculo do dígito verificador.
 *
 * '0'-'9' → 0-9 (código ASCII 48-57 menos 48).
 * 'A'-'Z' → 17-42 (código ASCII 65-90 menos 48).
 */
function characterValue(char) {
  return char.charCodeAt(0) - 48;
}
