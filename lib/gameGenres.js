/**
 * Gêneros de jogo — regras puras do catálogo em DOIS NÍVEIS.
 *
 * `games.genre` era texto livre e o filtro comparava a string inteira
 * (`g.genre = $1`) contra uma lista fixa de 15 valores que nenhum estúdio usava.
 *
 * ## Por que o pai também é linkável
 *
 * "Puzzle" é gênero **e** tem subgêneros. Quem não sabe dizer qual marca o pai,
 * e o filtro por "Puzzle" precisa continuar achando o jogo.
 *
 * ## Por que a hierarquia é dado e não código
 *
 * Diferente de `lib/professionGroups.js` (onde o grupo é estrutura que só o
 * código renderiza), aqui o pai é gênero de verdade, com nome próprio numa FK.
 * Em código, renomear "Ação" exigiria deploy e os vínculos dos jogos apontariam
 * para um rótulo inexistente.
 *
 * O que fica aqui são só as REGRAS: limites, normalização e leitura de valor
 * legado.
 */

/** Quantos gêneros (pai ou filho) um jogo pode ter. */
export const MAX_GAME_GENRES = 5;

/** Limite do nome — o mesmo de `game_genres.name`. */
export const MAX_GENRE_NAME_LENGTH = 60;

/**
 * Valor histórico de "sem gênero" (`games.genre` era `NOT NULL DEFAULT
 * 'Indefinido'`). Não é gênero: vira ausência de vínculo e é recusado como nome
 * no catálogo.
 */
export const NO_GENRE = "Indefinido";

/** Nome na forma comparável: sem acento, minúsculo, espaços colapsados. */
export function genreKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome pronto para gravar (aparado, espaços colapsados); `null` se vazio. */
export function normalizeGenreName(value) {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return name || null;
}

/**
 * Quebra um valor "livre" em gêneros — usado pela migration e pelo payload
 * antigo (`genre: "Ação, Aventura"`).
 *
 * NENHUM nome do catálogo contém `/`, `,`, `|`, `;` ou `\`: é esta função que os
 * quebraria ao reprocessar um valor legado. "Beat 'em up" e "Hack and Slash"
 * são nós distintos justamente por isso.
 */
export function splitGenreNames(value) {
  const parts = String(value ?? "")
    .split(/[,/|;\\]/)
    .map((part) => normalizeGenreName(part))
    .filter(Boolean);

  const seen = new Set();
  const names = [];

  for (const part of parts) {
    const key = genreKey(part);
    if (!key || key === genreKey(NO_GENRE) || seen.has(key)) continue;
    seen.add(key);
    names.push(part);
  }

  return names;
}

/**
 * Normaliza uma seleção vinda da tela.
 *
 * Duas regras, ambas para a seleção não gastar slot à toa:
 *
 *  1. deduplica pela `genreKey` ("Luta" e "luta" são o mesmo nó);
 *  2. **remove o pai quando um filho dele está presente** — marcar "Ação" +
 *     "Shooter" ocupa 2 dos 5 slots para dizer a mesma coisa, e o filtro por
 *     "Ação" já alcança o jogo pelo filho.
 *
 * @param {string[]} selected nomes escolhidos
 * @param {{name: string, parent_name: string|null}[]} nodes catálogo completo
 * @returns {string[]} seleção pronta para gravar
 */
export function normalizeSelection(selected, nodes) {
  const byKey = new Map(nodes.map((node) => [genreKey(node.name), node]));
  const unique = [];
  const seen = new Set();

  for (const raw of Array.isArray(selected) ? selected : []) {
    const node = byKey.get(genreKey(raw));
    if (!node || seen.has(genreKey(node.name))) continue;
    seen.add(genreKey(node.name));
    unique.push(node);
  }

  const coveredParents = new Set(unique.filter((node) => node.parent_name).map((node) => genreKey(node.parent_name)));

  return unique.filter((node) => !coveredParents.has(genreKey(node.name))).map((node) => node.name);
}

/** Caminho legível: `Ação › Shooter` quando há pai. */
export function genrePath(node) {
  if (!node) return "";
  return node.parent_name ? `${node.parent_name} › ${node.name}` : node.name;
}

const gameGenres = {
  MAX_GAME_GENRES,
  MAX_GENRE_NAME_LENGTH,
  NO_GENRE,
  genreKey,
  normalizeGenreName,
  splitGenreNames,
  normalizeSelection,
  genrePath,
};

export default gameGenres;
