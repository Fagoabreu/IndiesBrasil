/**
 * Registro único dos destaques da home (`/api/v1/highlights`).
 *
 * Servidor e cliente precisam da MESMA lista de tipos: a rota monta uma query
 * por tipo e a página decide o layout pelo total (`HIGHLIGHTS_PER_TYPE` ×
 * tipos). Duas cópias divergiriam — e a página passaria a agrupar tipos que o
 * endpoint não devolve mais.
 *
 * Módulo puro de propósito: importado por uma `page`, ele não pode puxar
 * `infra/database` (o pool do Postgres iria para o bundle do navegador).
 */

/** Quantos itens de **cada** tipo a seção "Destaques" mostra. */
export const HIGHLIGHTS_PER_TYPE = 3;

/**
 * Tipos na ordem em que aparecem no grid. É também a ordem de leitura do
 * agrupamento por coluna: jogos, jogos de mesa, livros, assets.
 */
export const HIGHLIGHT_TYPES = ["game", "boardgame", "book", "asset"];

export const HIGHLIGHT_TYPE_LABELS = {
  game: "Jogo",
  boardgame: "Jogo de Mesa",
  book: "Livro / Quadrinho",
  asset: "Asset",
};

export const HIGHLIGHT_TYPE_ROUTES = {
  game: "/jogos",
  boardgame: "/jogos-de-mesa",
  book: "/quadrinhos",
  asset: "/assets",
};

/** Total de cards quando todos os tipos estão cheios (12). */
export const HIGHLIGHTS_MAX_ITEMS = HIGHLIGHTS_PER_TYPE * HIGHLIGHT_TYPES.length;

/**
 * O grid agrupa por tipo (uma coluna por tipo) apenas quando o total é múltiplo
 * de `HIGHLIGHTS_PER_TYPE` — 3, 6, 9 ou 12 itens.
 *
 * Fora disso o agrupamento mentiria: com 2 jogos e 3 livros, a leitura por
 * coluna colocaria um livro na coluna dos jogos. Nesse caso a seção usa a grade
 * fluida normal.
 */
export function shouldGroupHighlights(total) {
  return Number.isInteger(total) && total > 0 && total % HIGHLIGHTS_PER_TYPE === 0;
}

const highlights = {
  HIGHLIGHTS_PER_TYPE,
  HIGHLIGHTS_MAX_ITEMS,
  HIGHLIGHT_TYPES,
  HIGHLIGHT_TYPE_LABELS,
  HIGHLIGHT_TYPE_ROUTES,
  shouldGroupHighlights,
};

export default highlights;
