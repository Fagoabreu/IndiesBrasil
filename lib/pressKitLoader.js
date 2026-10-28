/**
 * Carrega um press kit de produto no servidor.
 *
 * ## Por que existe
 *
 * As três páginas de press kit (`/jogos/<slug>/press-kit`,
 * `/jogos-de-mesa/<slug>/press-kit`, `/quadrinhos/<slug>/press-kit`) fazem a
 * mesma sequência: model do tipo → serializar → estúdio (membros e contatos) →
 * builder. Escrever isso três vezes faria a primeira correção (um campo novo, um
 * `try` a mais) entrar em uma só — e as outras duas ficariam publicando um
 * documento diferente sem ninguém notar.
 *
 * ## Import dinâmico de propósito
 *
 * `getServerSideProps` roda no servidor, mas o grafo estático da página é
 * compartilhado com o bundle do cliente. Importar `models/game` (que puxa
 * `infra/database` → `pg` → `net`/`fs`) no topo do arquivo quebraria o build —
 * por isso os models são resolvidos **dentro** da função, como as páginas de
 * conteúdo já fazem.
 *
 * Falha de leitura (slug inexistente, moderado, estúdio bloqueado) vira `null`,
 * e a página responde 404 de verdade. Engolir o erro aqui não esconde problema:
 * o model já traduziu "não existe" para `NotFoundError`, e o resto é o mesmo
 * caminho de qualquer página de conteúdo do site.
 */

/** Contexto de estúdio a partir da linha do produto (que já traz `studio_slug`). */
async function loadStudioContext(row) {
  if (!row?.studio_slug) return null;

  const [{ default: organization }, pressKit] = await Promise.all([import("@/models/organization"), import("@/lib/productPressKit")]);

  const studio = await organization.findBySlug(row.studio_slug);
  const [members, contacts] = await Promise.all([organization.findMembers(studio.id), organization.findContacts(studio.id)]);

  return pressKit.studioContext({ studio, members, contacts });
}

async function loadGame(slug) {
  const [{ default: game }, pressKit] = await Promise.all([import("@/models/game"), import("@/lib/productPressKit")]);
  const row = JSON.parse(JSON.stringify(await game.findBySlug(slug)));
  return pressKit.buildGamePressKit(row, await loadStudioContext(row));
}

async function loadBoardgame(slug) {
  const [{ default: boardgame }, pressKit] = await Promise.all([import("@/models/boardgame"), import("@/lib/productPressKit")]);
  const row = JSON.parse(JSON.stringify(await boardgame.findBySlug(slug)));
  // `findBySlug` não traz mídia (é tabela separada) — o documento precisa dela.
  const media = JSON.parse(JSON.stringify(await boardgame.findMedia(row.id)));
  return pressKit.buildBoardgamePressKit(row, media, await loadStudioContext(row));
}

async function loadBook(slug) {
  const [{ default: book }, pressKit] = await Promise.all([import("@/models/book"), import("@/lib/productPressKit")]);
  const row = JSON.parse(JSON.stringify(await book.findBySlug(slug)));
  return pressKit.buildBookPressKit(row, await loadStudioContext(row));
}

const LOADERS = { game: loadGame, boardgame: loadBoardgame, book: loadBook };

/**
 * @param {"game"|"boardgame"|"book"} kind
 * @param {string} slug
 * @returns {Promise<object|null>} dados para `<ProductPressKit data={...} />`.
 */
export async function loadProductPressKit(kind, slug) {
  const load = LOADERS[kind];
  if (!load) throw new Error(`Press kit de produto: tipo desconhecido "${kind}".`);

  try {
    return await load(slug);
  } catch {
    return null;
  }
}

const pressKitLoader = { loadProductPressKit };

export default pressKitLoader;
