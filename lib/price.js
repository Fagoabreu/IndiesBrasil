/**
 * Normalização e formatação de valor monetário informativo.
 *
 * Dois lugares guardam preço **sem checkout**: `assets.price` (o pacote é
 * referenciado externamente) e `organization_services.price` (o serviço é
 * combinado por mensagem). A regra de aceitação é a mesma — valor finito, maior
 * ou igual a zero, com duas casas — e duas cópias dela divergiriam: uma
 * passaria a aceitar string e a outra não, e o mesmo formulário responderia 400
 * num lugar e 500 no outro.
 *
 * A função recebe o valor já decidido sobre "é gratuito?" porque esse conceito
 * não existe no serviço: `assets` tem `is_free`, `organization_services` não.
 */

import { formatBRL } from "./currency";

/**
 * Valor pronto para gravar, ou `null`.
 *
 * `undefined`, `null` e `""` significam "sem preço" (não é erro: o campo é
 * opcional em ambos os casos). Qualquer outro valor precisa ser numérico e não
 * negativo — senão é 400, porque o formulário errou, não o servidor.
 *
 * @param {unknown} raw — valor cru vindo do corpo da requisição
 * @param {(message: string) => Error} makeError — construtor do erro de
 *   validação injetado pelo chamador (`lib/` não importa `infra/errors`, que
 *   arrasta dependências de servidor para o bundle do cliente).
 * @returns {number|null}
 */
export function normalizePrice(raw, makeError) {
  if (raw === undefined || raw === null || raw === "") return null;

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw makeError("Informe um valor numérico maior ou igual a zero.");
  }

  return Number(value.toFixed(2));
}

/**
 * Texto de exibição: `"R$ 1.500,00 por projeto"`, `"R$ 1.500,00"`,
 * `"A combinar"` ou `null`.
 *
 * A nota só acompanha um valor existente **ou** aparece sozinha quando é texto
 * livre — é o caso de "A combinar", em que não há número nenhum.
 */
export function formatPriceWithNote(price, note) {
  const trimmedNote = typeof note === "string" ? note.trim() : "";
  const hasPrice = price !== null && price !== undefined && price !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;

  if (!hasPrice) return trimmedNote || null;

  const formatted = formatBRL(price);
  return trimmedNote ? `${formatted} ${trimmedNote}` : formatted;
}
