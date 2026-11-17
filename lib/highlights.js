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
 * Tipos na ordem das linhas de destaque na home: jogos, jogos de mesa, livros,
 * assets. A ordem importa — a seção lê de cima para baixo.
 */
export const HIGHLIGHT_TYPES = ["game", "boardgame", "book", "asset"];

/**
 * Rótulo do selo sobre o card (singular: "Jogo", "Asset").
 *
 * Para o título da LINHA use `HIGHLIGHT_TYPE_HEADINGS`: "3 Assets" com rótulo
 * singular e caixa alta lia como nome de campo de banco.
 */
export const HIGHLIGHT_TYPE_LABELS = {
  game: "Jogo",
  boardgame: "Jogo de Mesa",
  book: "Livro / Quadrinho",
  asset: "Asset",
};

/**
 * Título da linha de cada tipo na seção "Destaques" — plural e em caixa de
 * frase, como todo título de card do site.
 */
export const HIGHLIGHT_TYPE_HEADINGS = {
  game: "Jogos",
  boardgame: "Jogos de mesa",
  book: "Livros e quadrinhos",
  asset: "Artes e assets",
};

export const HIGHLIGHT_TYPE_ROUTES = {
  game: "/jogos",
  boardgame: "/jogos-de-mesa",
  book: "/quadrinhos",
  asset: "/assets",
};

/**
 * Feature que autoriza a LEITURA de cada tipo.
 *
 * A home renderiza os destaques no servidor, onde o middleware não roda: o gate
 * é `anonymousCan(feature)` por tipo, como em `pages/sitemap/[type].js`. Sem
 * esta lista, revogar `read:asset:all` do anônimo tiraria os assets do sitemap e
 * os deixaria no HTML da home — anunciando endereço que responde 404.
 */
export const HIGHLIGHT_TYPE_FEATURES = {
  game: "read:game:all",
  boardgame: "read:boardgame:all",
  book: "read:book:all",
  asset: "read:asset:all",
};

/** Total de cards quando todos os tipos estão cheios (12). */
export const HIGHLIGHTS_MAX_ITEMS = HIGHLIGHTS_PER_TYPE * HIGHLIGHT_TYPES.length;

/**
 * Agrupa os destaques em uma linha por tipo, na ordem de `HIGHLIGHT_TYPES`.
 *
 * A seção lia os cards em **coluna** (`grid-auto-flow: column`) e o tipo de cada
 * um só existia como selo sobre a arte: para saber onde terminavam os jogos e
 * começavam os jogos de mesa era preciso ler quatro etiquetas. Como linha, o
 * agrupamento vem de um título — e cada linha pode ter o link para a listagem
 * completa, que a coluna não tinha espaço para exibir.
 *
 * Tipo sem item não gera linha (uma faixa vazia com título é pior que ausência:
 * sugere que não há nada daquele tipo no site).
 * @param {Array<{ type: string }>} items
 */
export function groupHighlightsByType(items) {
  if (!Array.isArray(items)) return [];

  return HIGHLIGHT_TYPES.map((type) => ({
    type,
    heading: HIGHLIGHT_TYPE_HEADINGS[type],
    route: HIGHLIGHT_TYPE_ROUTES[type],
    items: items.filter((item) => item?.type === type),
  })).filter((group) => group.items.length > 0);
}

const highlights = {
  HIGHLIGHTS_PER_TYPE,
  HIGHLIGHTS_MAX_ITEMS,
  HIGHLIGHT_TYPES,
  HIGHLIGHT_TYPE_LABELS,
  HIGHLIGHT_TYPE_HEADINGS,
  HIGHLIGHT_TYPE_ROUTES,
  HIGHLIGHT_TYPE_FEATURES,
  groupHighlightsByType,
};

export default highlights;
