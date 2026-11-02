/**
 * Normalização do filtro `?service=` das listagens.
 *
 * Módulo puro: valida a **forma** do parâmetro (uma string, sem repetição). A
 * existência do serviço é conferida pela rota, que tem acesso ao model — e a
 * separação é de propósito, porque este arquivo também é importado pela página
 * de estúdios no cliente.
 *
 * Por que recusar em vez de ignorar: `?service=portabilidde` devolvendo a lista
 * inteira faria o filtro parecer aplicado; devolvendo lista vazia faria parecer
 * que ninguém oferece o serviço. Nos dois casos o erro é de digitação, e é isso
 * que a resposta precisa dizer.
 */

import { ValidationError } from "infra/errors";

/** Valor normalizado do filtro, ou `""` quando não há filtro. */
export function parseServiceFilter(raw) {
  if (raw === undefined || raw === null || raw === "") return "";

  // `?service=a&service=b` chega como array: escolher um dos dois em silêncio
  // esconderia o erro de quem montou o link.
  if (Array.isArray(raw)) {
    throw new ValidationError({
      message: "Parâmetro de serviço enviado mais de uma vez.",
      action: "Envie apenas um serviço por vez.",
    });
  }

  const slug = String(raw).trim();
  if (!slug) return "";

  // O slug do serviço é gerado por `generateUniqueSlug`: minúsculas, dígitos e
  // hífen. Qualquer outra coisa não pode existir no catálogo, então recusar aqui
  // evita uma consulta que já se sabe vazia.
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) {
    throw new ValidationError({
      message: "Serviço não encontrado.",
      action: "Confira o endereço ou limpe o filtro de serviço.",
    });
  }

  return slug;
}
