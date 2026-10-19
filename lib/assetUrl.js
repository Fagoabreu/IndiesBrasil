/**
 * Normalização da URL externa de um asset.
 *
 * O site **referencia** o asset, não o hospeda: `assets.external_url` é o
 * endereço onde o arquivo realmente está (itch.io, Kenney, OpenGameArt, GitHub,
 * o site do estúdio…). Por isso a regra é só de forma — qual endereço é aceito:
 *
 *  - apenas `http:` e `https:`; `javascript:`, `data:` e `file:` não são links;
 *  - nada de credenciais embutidas (`usuario:senha@host`): a URL é publicada
 *    numa página aberta, e um link com senha vaza o segredo;
 *  - o valor devolvido é a forma canônica (`URL#href`), para a comparação e a
 *    exibição não dependerem de como o usuário digitou.
 *
 * Não há checagem de rede aqui de propósito. Validar a URL não exige buscar o
 * endereço — e buscar uma URL fornecida pelo usuário é justamente o caminho que
 * `lib/safe-fetch.js` existe para cobrir (redirect + DNS rebinding). Se um dia
 * houver preview do link externo, ele passa por lá; esta função continua sendo
 * só de forma.
 */

/** Forma canônica da URL, ou `null` quando o valor não serve como link público. */
export function normalizeAssetUrl(raw) {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  if (parsed.username || parsed.password) return null;

  return parsed.href;
}

/** Verdadeiro quando o valor é aceitável como URL externa de asset. */
export function isValidAssetUrl(value) {
  return normalizeAssetUrl(value) !== null;
}
