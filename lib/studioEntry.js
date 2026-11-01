/**
 * Destino das ações de "publicar" espalhadas pelo site.
 *
 * A navegação é **content-first** (Jogos, Assets, Streams), mas o modelo é
 * **studio-first**: nenhum produto existe fora de um estúdio. Sem uma ponte, a
 * pessoa que quer publicar chega numa listagem, não vê nenhuma ação e conclui
 * que o site não aceita contribuição.
 *
 * ## Por que um módulo puro
 *
 * A decisão "para onde este botão leva" depende de três estados de sessão (sem
 * conta, conta sem estúdio, conta com estúdio — e com dois ou mais estúdios um
 * quarto caso). Decidir isso dentro do JSX de cada listagem significa cinco
 * cópias da mesma escada de `if`, e a primeira divergência passa despercebida
 * porque cada página é lida isoladamente. Aqui a regra é testável sem banco
 * (`tests/unit/lib/studioEntry.test.js`), como `lib/memberSort.js`.
 *
 * O módulo **não** importa `context/` nem model nenhum: recebe o usuário e a
 * lista de estúdios já resolvidos e devolve só `{ href, label, hint, kind }`.
 * Isso permite usá-lo no servidor (SSR das listagens) e no cliente.
 */

/**
 * Aba de `/configuracoes` onde cada tipo de produto é publicado.
 *
 * Repete os `id`s de `STUDIO_TABS` (`pages/estudios/[slug]/configuracoes.js`) de
 * propósito: importar aquele arquivo traria a página inteira (com fetch,
 * modais e CSS) para o bundle de qualquer listagem. A lista é curta e estável,
 * e `tests/unit/lib/studioEntry.test.js` fixa os valores.
 */
export const STUDIO_PRODUCT_TABS = {
  games: "games",
  boardgames: "boardgames",
  books: "books",
  streaming: "streaming",
  assets: "assets",
};

/** `kind` de cada ação — o texto do botão muda com o estado da sessão. */
export const STUDIO_ENTRY_KINDS = {
  LOGIN: "login",
  CREATE: "create",
  PUBLISH: "publish",
  CHOOSE: "choose",
};

/** Rota pública que explica o modelo para quem só quer entender antes de criar. */
export const HOW_TO_PUBLISH_PATH = "/como-publicar";

/** Quantos estúdios do usuário são assumidos como "um só" (o único). */
function firstStudio(studios) {
  if (!Array.isArray(studios) || studios.length === 0) return null;
  return studios[0] ?? null;
}

/**
 * Resolve o destino do botão de publicação.
 *
 * @param {object} params
 * @param {object|null} params.user     — usuário da sessão (`null` = visitante)
 * @param {boolean} [params.loadingUser] — sessão ainda carregando
 * @param {Array<{slug: string}>} [params.studios] — estúdios do usuário
 * @param {string} [params.tab]         — aba de produto (`games`, `assets`…)
 * @returns {{ kind: string, href: string, label: string, hint: string }}
 */
export function resolveStudioEntry({ user = null, loadingUser = false, studios = [], tab = "" } = {}) {
  const studioTab = STUDIO_PRODUCT_TABS[tab] ?? "";

  // Sessão ainda carregando: não afirmamos nada sobre o usuário. O botão sai
  // apontando para a criação, que é o mesmo destino de quem é visitante — e a
  // navegação por link real nunca depende do efeito de cliente, que não roda
  // no servidor.
  if (!user || loadingUser) {
    return {
      kind: STUDIO_ENTRY_KINDS.LOGIN,
      href: `/login?next=${encodeURIComponent(studioTab ? `/estudios?tab=member` : "/estudios/novo")}`,
      label: "Entrar para publicar",
      hint: "Criar um estúdio exige uma conta — leva menos de um minuto.",
    };
  }

  const only = firstStudio(studios);
  const hasStudios = Array.isArray(studios) && studios.length > 0;

  if (!hasStudios) {
    return {
      kind: STUDIO_ENTRY_KINDS.CREATE,
      href: "/estudios/novo",
      label: "Criar meu estúdio",
      hint: "Todo conteúdo é publicado por um estúdio. Crie o seu para começar.",
    };
  }

  // Um estúdio só: vamos direto à aba certa — o caminho mais curto entre a
  // listagem e o formulário de publicação.
  if (studios.length === 1 && only?.slug) {
    const query = studioTab ? `?tab=${studioTab}` : "";
    return {
      kind: STUDIO_ENTRY_KINDS.PUBLISH,
      href: `/estudios/${only.slug}/configuracoes${query}`,
      label: "Publicar no meu estúdio",
      hint: `Você publica pelo estúdio “${only.name ?? only.slug}”.`,
    };
  }

  // Vários estúdios: publicar em qual deles é decisão da pessoa, não nossa.
  return {
    kind: STUDIO_ENTRY_KINDS.CHOOSE,
    href: "/estudios?tab=member",
    label: "Escolher estúdio",
    hint: "Você faz parte de mais de um estúdio — escolha em qual vai publicar.",
  };
}
