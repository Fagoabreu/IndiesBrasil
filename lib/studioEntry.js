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
  services: "services",
};

/** `kind` de cada ação — o texto do botão muda com o estado da sessão. */
export const STUDIO_ENTRY_KINDS = {
  LOGIN: "login",
  CREATE: "create",
  PUBLISH: "publish",
  CHOOSE: "choose",
  /**
   * Sessão OK, mas a lista de estúdios ainda **não chegou**.
   *
   * É um estado próprio porque `[]` e "não sei" não são a mesma coisa: tratar os
   * dois como "sem estúdio" mandava quem tem estúdio para `/estudios/novo` no
   * primeiro segundo da página — o botão era clicado antes de a requisição
   * responder.
   */
  PENDING: "pending",
};

/** Rota pública que explica o modelo para quem só quer entender antes de criar. */
export const HOW_TO_PUBLISH_PATH = "/como-publicar";

/**
 * A pessoa pode publicar/editar neste estúdio?
 *
 * Dono e administrador sim; membro comum não — a declaração de serviços, de
 * produtos e de contatos exige `isAdmin || owner` no servidor. Decidir aqui a
 * mesma regra evita oferecer um botão que termina em 403.
 *
 * Papel ausente conta como **editável** de propósito: `myStudios` pode vir de um
 * payload antigo em cache durante o deploy, e esconder o estúdio de quem tem
 * acesso é pior que mostrar um destino que o servidor ainda vai recusar.
 */
export function canEditStudio(studio) {
  const role = studio?.role;
  if (!role) return true;
  return role === "owner" || role === "admin";
}

/** Estúdios em que a pessoa pode de fato escrever (ver `canEditStudio`). */
export function editableStudios(studios) {
  if (!Array.isArray(studios)) return [];
  return studios.filter(canEditStudio);
}

/**
 * Resolve o destino do botão de publicação.
 *
 * @param {object} params
 * @param {object|null} params.user     — usuário da sessão (`null` = visitante)
 * @param {boolean} [params.loadingUser] — sessão ainda carregando
 * @param {Array<{slug: string}>|null} [params.studios] — estúdios do usuário;
 *   `null` significa **desconhecido** (ainda carregando ou a consulta falhou)
 * @param {string} [params.tab]         — aba de produto (`games`, `assets`…)
 * @returns {{ kind: string, href: string, label: string, hint: string }}
 */
export function resolveStudioEntry({ user = null, loadingUser = false, studios = null, tab = "" } = {}) {
  const studioTab = STUDIO_PRODUCT_TABS[tab] ?? "";

  // Sessão ainda carregando: não afirmamos nada sobre o usuário. O botão sai
  // apontando para a criação, que é o mesmo destino de quem é visitante — e a
  // navegação por link real nunca depende do efeito de cliente, que não roda
  // no servidor.
  if (!user || loadingUser) {
    return {
      kind: STUDIO_ENTRY_KINDS.LOGIN,
      href: `/login?next=${encodeURIComponent(studioTab ? `/estudios?member=me` : "/estudios/novo")}`,
      label: "Entrar para publicar",
      hint: "Criar um estúdio exige uma conta — leva menos de um minuto.",
    };
  }

  /*
   * Lista desconhecida ≠ lista vazia.
   *
   * `myStudios` começa nula e só vira array quando `/api/v1/studios?member=me`
   * responde. Sem esta distinção, o botão de quem **tem** estúdio apontava para
   * `/estudios/novo` durante o primeiro instante da página — e quem clicasse
   * rápido caía na criação de um estúdio que já existia.
   *
   * O destino seguro é a lista dos meus estúdios: ela serve aos dois casos (com
   * estúdio, mostra os cards; sem, oferece criar), ao contrário de
   * `/estudios/novo`, que só serve a um deles.
   */
  if (!Array.isArray(studios)) {
    return {
      kind: STUDIO_ENTRY_KINDS.PENDING,
      href: "/estudios?member=me",
      label: "Meus estúdios",
      hint: "Confira os estúdios de que você participa.",
    };
  }

  const hasStudios = studios.length > 0;

  // Só os estúdios em que a pessoa pode escrever entram na decisão: ser membro
  // comum de três estúdios não é "escolha entre três", é "nenhum".
  const editable = editableStudios(studios);

  if (!hasStudios) {
    return {
      kind: STUDIO_ENTRY_KINDS.CREATE,
      href: "/estudios/novo",
      label: "Criar meu estúdio",
      hint: "Todo conteúdo é publicado por um estúdio. Crie o seu para começar.",
    };
  }

  /*
   * Nenhum estúdio editável: a pessoa é membro comum de um ou mais estúdios.
   * Mandá-la para `/estudios/novo` sugeriria criar um novo quando o problema é
   * permissão no que já existe; o seletor mostra os estúdios com o papel de cada
   * um e explica que publicar exige dono ou administrador.
   */
  if (editable.length === 0) {
    return {
      kind: STUDIO_ENTRY_KINDS.CHOOSE,
      href: studioChooserHref(studioTab),
      label: "Ver meus estúdios",
      hint: "Você é membro, mas publicar exige ser responsável ou administrador do estúdio.",
    };
  }

  // Um estúdio editável: vamos direto à aba certa — o caminho mais curto entre a
  // listagem e o formulário de publicação.
  if (editable.length === 1 && editable[0]?.slug) {
    const query = studioTab ? `?tab=${studioTab}` : "";
    return {
      kind: STUDIO_ENTRY_KINDS.PUBLISH,
      href: `/estudios/${editable[0].slug}/configuracoes${query}`,
      label: "Publicar no meu estúdio",
      hint: `Você publica pelo estúdio “${editable[0].name ?? editable[0].slug}”.`,
    };
  }

  // Vários estúdios editáveis: a escolha é da pessoa, e ela acontece **antes** do
  // formulário — abrir a aba de um estúdio arbitrário faria a pessoa declarar no
  // lugar errado e só perceber depois de salvar.
  return {
    kind: STUDIO_ENTRY_KINDS.CHOOSE,
    href: studioChooserHref(studioTab),
    label: "Escolher estúdio",
    hint: `Você administra ${editable.length} estúdios — escolha em qual vai publicar.`,
  };
}

/**
 * Endereço do seletor de estúdio, preservando a aba escolhida.
 *
 * A aba vai na query porque é ela que diz **o que** a pessoa quer publicar: o
 * seletor não decide isso, só o dono do clique.
 */
export function studioChooserHref(tab = "") {
  const studioTab = STUDIO_PRODUCT_TABS[tab] ?? "";
  return studioTab ? `/estudios/escolher?tab=${studioTab}` : "/estudios/escolher";
}
