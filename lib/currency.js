/**
 * Formata um valor numérico como moeda brasileira (BRL).
 *
 * @param {number|string} value — valor a formatar (ex: 1234.5)
 * @returns {string} Valor formatado (ex: "R$ 1.234,50") ou "" se inválido.
 */
export function formatBRL(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeric);
}
