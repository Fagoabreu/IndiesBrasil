/**
 * Valida um CNPJ pelo algoritmo oficial de dígitos verificadores.
 *
 * Aceita CNPJ com ou sem máscara (pontos, barra e hífen são ignorados).
 *
 * @param {string} cnpj — CNPJ a validar (ex: "11.222.333/0001-81")
 * @returns {boolean} true se o CNPJ é válido.
 */
export function isValidCnpj(cnpj) {
  const digits = String(cnpj || "").replace(/\D/g, "");

  if (digits.length !== 14) return false;
  // Rejeita sequências de dígitos repetidos (ex: 00000000000000).
  if (/^(\d)\1{13}$/.test(digits)) return false;

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
    sum += Number(base[i]) * weights[i];
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
