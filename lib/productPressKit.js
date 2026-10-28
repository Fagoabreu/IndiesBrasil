/**
 * Press kit de um produto (jogo, jogo de mesa, quadrinho/livro).
 *
 * ## Por que um módulo puro
 *
 * O documento tem as mesmas seções nos três tipos — factsheet, descrição em
 * níveis, mídia, estúdio, equipe e contato de imprensa — e a diferença entre
 * eles é só **quais campos existem**. Montar isso no JSX de cada página
 * significaria três cópias do mesmo raciocínio (o que entra no factsheet, o que
 * some quando vazio, qual texto é o pitch), e a primeira divergência passaria
 * despercebida porque cada página é lida isoladamente.
 *
 * Não importa banco nem model: recebe as linhas já lidas (`game.findBySlug`,
 * `boardgame.findBySlug`, `book.findBySlug`) e o contexto do estúdio. Isso deixa
 * o formato testável sem subir o Postgres (`tests/unit/lib/`).
 *
 * ## Nada de campo vazio
 *
 * Cada seção devolve apenas o que existe. Um `value: undefined` no factsheet é
 * pior do que a linha ausente: some o conteúdo e fica o rótulo (ou, no JSX, um
 * `<dd>` em branco). É o mesmo critério do `compact` do JSON-LD.
 */

import { formatBRL } from "@/lib/currency";
import { RATING_LABELS } from "@/lib/rating-constants";

/* =========================================================
 * Rótulos — registro único
 * ========================================================= */

export const STAGE_LABELS = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  writing: "Escrevendo",
  crowdfunding: "Financiamento Coletivo",
  production: "Em Produção",
  released: "Lançado",
  cancelled: "Cancelado",
};

/** Livro e quadrinho usam "Publicado" no lugar de "Lançado". */
export const BOOK_STAGE_LABELS = { ...STAGE_LABELS, released: "Publicado" };

export const GAME_PLATFORM_LABELS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  ps5: "PlayStation 5",
  ps4: "PlayStation 4",
  xbox_series: "Xbox Series X|S",
  xbox_one: "Xbox One",
  switch: "Nintendo Switch",
  ios: "iOS",
  android: "Android",
  browser: "Navegador",
};

export const BOOK_TYPE_LABELS = {
  book: "Livro",
  comic: "Quadrinho",
  manga: "Mangá",
  graphic_novel: "Romance Gráfico",
  zine: "Zine",
  artbook: "Artbook",
  rpg_manual: "Manual de RPG",
  other: "Outro",
};

export const BOARDGAME_CATEGORY_LABELS = {
  board_game: "Tabuleiro",
  card_game: "Cartas",
  rpg: "RPG de Mesa",
  dice_game: "Dados",
  miniature: "Miniaturas",
  party_game: "Party Game",
};

/** Tipos aceitos por `buildProductPressKit` — a chave de `routeSegment`. */
export const PRODUCT_KINDS = {
  game: { label: "Jogo", routeSegment: "jogos" },
  boardgame: { label: "Jogo de Mesa", routeSegment: "jogos-de-mesa" },
  book: { label: "Publicação", routeSegment: "quadrinhos" },
};

/* =========================================================
 * Helpers
 * ========================================================= */

/**
 * `release_date` é DATE — chega como `Date` do node-pg e como string depois do
 * `JSON.parse(JSON.stringify(...))` do SSR. Nos dois casos o dia civil está em
 * **UTC**: `new Date("2026-10-12")` é meia-noite UTC, e formatar sem `timeZone`
 * no servidor (que roda em BRT) devolve **11 de outubro**. É o mesmo defeito já
 * documentado para eventos em `lib/eventFormat.js`.
 */
export function formatReleaseDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Texto não vazio, ou `null`. Evita `"   "` virando valor de factsheet. */
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

/** "A–B jogadores" / "2 jogadores" / null. */
function playerRange(min, max) {
  const low = Number(min) || null;
  const high = Number(max) || null;
  if (!low && !high) return null;
  if (!high || low === high) return `${low ?? high} jogador${(low ?? high) > 1 ? "es" : ""}`;
  if (!low) return `Até ${high} jogadores`;
  return `${low}–${high} jogadores`;
}

/** "30–90 min" / "60 min" / null. */
function playTimeRange(min, max) {
  const low = Number(min) || null;
  const high = Number(max) || null;
  if (!low && !high) return null;
  if (!high || low === high) return `${low ?? high} min`;
  if (!low) return `Até ${high} min`;
  return `${low}–${high} min`;
}

/**
 * Primeiro parágrafo da descrição — o "pitch" de uma linha.
 *
 * Usa a primeira quebra de linha em branco como fronteira; descrição sem
 * parágrafo separado devolve o texto inteiro (e o dedupe abaixo evita repetir).
 */
function firstParagraph(description) {
  const body = text(description);
  if (!body) return null;
  const [first] = body.split(/\n\s*\n/);
  const paragraph = text(first);
  if (!paragraph || paragraph === body) return null;
  return paragraph;
}

/**
 * Níveis de descrição do presskit(): frase de efeito, resumo e texto completo.
 *
 * Um mesmo texto em dois lugares do documento parece erro de montagem — e era o
 * que acontecia quando a descrição tinha um parágrafo só. `promote` preenche o
 * nível vazio de cima com o de baixo e zera o repetido.
 */
function descriptionLevels(shortDescription, description) {
  let tagline = text(shortDescription);
  let pitch = firstParagraph(description);
  const about = text(description);

  // Sem frase de efeito própria, o primeiro parágrafo ocupa esse lugar — e
  // deixa de ser um "pitch" separado, senão o mesmo texto apareceria duas vezes.
  if (!tagline) {
    tagline = pitch ?? about;
    pitch = null;
  }

  // Descrição de um parágrafo só: ele é o resumo e o texto completo ao mesmo
  // tempo, e repetir o bloco inteiro abaixo do lead parece erro de montagem.
  if (pitch && pitch === tagline) pitch = null;
  if (about && (about === tagline || about === pitch)) {
    return { tagline, pitch, about: null };
  }

  return { tagline, pitch, about };
}

/** Detecta player de vídeo por URL — mesma regra do press kit do estúdio. */
export function videoEmbed(url) {
  const value = text(url);
  if (!value) return null;

  const youtube = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtube) {
    return { provider: "youtube", id: youtube[1], src: `https://www.youtube.com/embed/${youtube[1]}` };
  }

  const vimeo = value.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return { provider: "vimeo", id: vimeo[1], src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  return null;
}

/** Preview de link não é mídia: só imagens de verdade entram na galeria. */
function splitMedia(media) {
  const images = [];
  const videos = [];

  for (const item of list(media)) {
    if (!text(item?.url)) continue;
    if (item.media_type === "image") {
      images.push({ id: item.id, url: item.url, caption: text(item.caption) });
    } else if (item.media_type === "video") {
      videos.push({ id: item.id, url: item.url, caption: text(item.caption) });
    }
  }

  return { images, videos };
}

/**
 * Preço da ficha de lojas.
 *
 * Com um só valor, ele mesmo. Com vários, o menor — imprensa precisa de um
 * número de referência, e "a partir de" é o que o leitor entende. Nenhum preço
 * informado devolve `null` (a coluna some, em vez de virar "—").
 */
function priceSummary(storePages) {
  const prices = list(storePages)
    .map((page) => Number(page?.price))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (prices.length === 0) return null;
  if (prices.length === 1) return formatBRL(prices[0]);

  const min = Math.min(...prices);
  const allSame = prices.every((value) => value === min);
  return allSame ? formatBRL(min) : `A partir de ${formatBRL(min)}`;
}

function storeLinks(storePages) {
  return list(storePages)
    .filter((page) => text(page?.page_url))
    .map((page) => ({
      id: page.id,
      name: text(page.store_name) ?? "Loja",
      url: page.page_url,
      price: Number(page?.price) > 0 ? formatBRL(page.price) : null,
    }));
}

/**
 * Contato de imprensa.
 *
 * Preferência por e-mail (é o canal que a imprensa usa e o que fica registrado),
 * depois telefone/WhatsApp, e por último a página do estúdio. Contato sem URL
 * utilizável — um `@usuario` do Discord — não serve de contato de imprensa:
 * `href="@usuario"` é um link relativo para dentro do próprio site.
 */
function pickPressContact(contacts, studio) {
  const usable = list(contacts).filter((contact) => text(contact?.href));

  const byKey = (predicate) => usable.find((contact) => predicate(String(contact.icon_key ?? contact.label ?? "").toLowerCase()));

  const chosen =
    byKey((key) => key.includes("mail") || key === "email") ??
    byKey((key) => key.includes("whats") || key.includes("phone") || key.includes("fone") || key.includes("telefone")) ??
    usable[0] ??
    null;

  if (chosen) {
    return {
      label: chosen.label ?? chosen.icon_key ?? "Contato",
      display: chosen.display ?? chosen.value,
      href: chosen.href,
    };
  }

  if (studio?.slug) {
    return {
      label: "Imprensa",
      display: `Falar com ${studio.name}`,
      href: `/estudios/${studio.slug}`,
    };
  }

  return null;
}

/**
 * Contexto do estúdio a partir das linhas devolvidas pelos models.
 *
 * `organization.findBySlug` já traz a linha inteira (inclusive `history` e
 * `pitch`); `findMembers` e `findContacts` vêm separados porque dependem de
 * JOIN. Este helper só normaliza o que o documento consome e devolve `null`
 * quando o produto não pertence a um estúdio.
 */
export function studioContext({ studio, members, contacts } = {}) {
  if (!studio?.slug) return null;

  return {
    name: studio.name ?? studio.slug,
    slug: studio.slug,
    url: `/estudios/${studio.slug}`,
    logoUrl: studio.logo_url ?? null,
    bannerUrl: studio.banner_url ?? null,
    pitch: text(studio.pitch),
    history: text(studio.history),
    website: text(studio.website),
    foundedAt: formatReleaseDate(studio.founded_at),
    city: text(studio.city),
    state: text(studio.state),
    members: list(members).map((member) => ({
      id: member.user_id ?? member.id,
      username: member.username,
      displayName: text(member.display_name) ?? member.username,
      avatarUrl: member.avatar_url ?? null,
      roles: list(member.roles),
      bio: text(member.bio),
    })),
    contacts: list(contacts)
      .filter((contact) => text(contact?.contact_value))
      .map((contact) => ({
        id: contact.id,
        label: contact.label ?? contact.icon_key ?? "Contato",
        display: contact.display ?? contact.contact_value,
        href: text(contact.url) ? contact.url : null,
        value: contact.contact_value,
        iconImg: contact.icon_img ?? null,
      })),
  };
}

/* =========================================================
 * Builders
 * ========================================================= */

function baseFactsheet({ developer, releaseDate, stageValue, rating }) {
  const rows = [
    { label: "Desenvolvedor", value: developer.name, href: developer.url },
    { label: "Lançamento", value: releaseDate },
    { label: "Situação", value: stageValue },
    { label: "Classificação", value: rating },
  ];

  return rows.filter((row) => row.value);
}

function clean(rows) {
  return rows.filter((row) => row.value);
}

/**
 * Assets têm `url`/`label`, não `value` — passar por `clean` os apagaria todos, e
 * o documento sairia sem a key art (o herói ficava vazio e o bloco de logos
 * simplesmente não aparecia).
 */
function cleanAssets(items) {
  return items.filter((item) => text(item.url));
}

function developerOf(row, studio) {
  if (studio) return { name: studio.name, url: studio.url };
  const owner = text(row.owner_username);
  return owner ? { name: owner, url: `/perfil/${owner}` } : { name: null, url: null };
}

function ratingLabel(rating) {
  return rating ? (RATING_LABELS[rating] ?? rating) : null;
}

/**
 * Jogo digital.
 *
 * @param {object} row — linha de `game.findBySlug` (inclui `platforms`, `media`,
 *   `team`, `store_pages`, `tags` e os dados do estúdio).
 * @param {object} [ctx] — `studioContext(...)`.
 */
export function buildGamePressKit(row, ctx = null) {
  const studio = ctx ?? null;
  const developer = developerOf(row, studio);
  const { tagline, pitch, about } = descriptionLevels(row.short_description, row.description);
  const { images, videos } = splitMedia(row.media);
  const trailer = videoEmbed(row.trailer_url);
  const platforms = list(row.platforms).map((platform) => GAME_PLATFORM_LABELS[platform] ?? platform);
  const tags = list(row.tags).map((tag) => tag.name);
  const stores = storeLinks(row.store_pages);

  return {
    kind: "game",
    kindLabel: PRODUCT_KINDS.game.label,
    title: row.name,
    subtitle: null,
    tagline,
    url: `/jogos/${row.slug}`,
    pressKitUrl: `/jogos/${row.slug}/press-kit`,
    developer,
    factsheet: clean([
      ...baseFactsheet({
        developer,
        releaseDate: formatReleaseDate(row.release_date),
        stageValue: STAGE_LABELS[row.stage] ?? text(row.stage),
        rating: ratingLabel(row.content_rating),
      }),
      { label: "Plataformas", value: platforms.length ? platforms.join(", ") : null },
      { label: "Gênero", value: text(row.genre) === "Indefinido" ? null : text(row.genre) },
      { label: "Engine", value: text(row.engine) },
      { label: "Preço", value: priceSummary(row.store_pages) },
      { label: "Website", value: text(row.website_url), href: text(row.website_url) },
    ]),
    description: { tagline, pitch, about },
    features: tags,
    videos: trailer ? [{ id: "trailer", url: row.trailer_url, caption: "Trailer", embed: trailer }, ...videos] : videos,
    images,
    assets: cleanAssets([
      { url: row.banner_url, label: "Key art" },
      { url: row.cover_url, label: "Capa" },
      ...(studio?.logoUrl ? [{ url: studio.logoUrl, label: "Logo do estúdio" }] : []),
    ]),
    storeLinks: stores,
    credits: list(row.team).map((member) => ({
      id: member.id,
      name: text(member.display_name) ?? member.username,
      role: text(member.roles),
      username: member.username,
      avatarUrl: member.avatar_url ?? null,
    })),
    studio,
    pressContact: pickPressContact(studio?.contacts, studio),
    socials: list(studio?.contacts).filter((contact) => contact.href),
  };
}

/**
 * Jogo de mesa.
 *
 * `boardgame.findBySlug` não devolve mídia (é tabela separada) — a página passa
 * `boardgame.findMedia(id)` no segundo argumento.
 */
export function buildBoardgamePressKit(row, media = [], ctx = null) {
  const studio = ctx ?? null;
  const developer = developerOf(row, studio);
  const { tagline, pitch, about } = descriptionLevels(row.short_description, row.description);
  const { images, videos } = splitMedia(media);
  const mechanics = list(row.mechanics);

  return {
    kind: "boardgame",
    kindLabel: PRODUCT_KINDS.boardgame.label,
    title: row.name,
    subtitle: null,
    tagline,
    url: `/jogos-de-mesa/${row.slug}`,
    pressKitUrl: `/jogos-de-mesa/${row.slug}/press-kit`,
    developer,
    factsheet: clean([
      ...baseFactsheet({
        developer,
        releaseDate: formatReleaseDate(row.release_date),
        stageValue: STAGE_LABELS[row.stage] ?? text(row.stage),
        rating: ratingLabel(row.content_rating),
      }),
      { label: "Categoria", value: BOARDGAME_CATEGORY_LABELS[row.category] ?? text(row.category) },
      { label: "Jogadores", value: playerRange(row.player_count_min, row.player_count_max) },
      { label: "Duração", value: playTimeRange(row.play_time_min, row.play_time_max) },
      { label: "Idade mínima", value: Number(row.age_rating) > 0 ? `${Number(row.age_rating)}+` : null },
      { label: "Peso (BGG)", value: Number(row.weight) > 0 ? `${Number(row.weight).toFixed(1)} / 5` : null },
      { label: "Website", value: text(row.website_url), href: text(row.website_url) },
    ]),
    description: { tagline, pitch, about },
    features: mechanics,
    videos,
    images,
    assets: cleanAssets([
      { url: row.banner_url, label: "Key art" },
      { url: row.cover_url, label: "Capa" },
      ...(studio?.logoUrl ? [{ url: studio.logoUrl, label: "Logo do estúdio" }] : []),
    ]),
    storeLinks: [],
    credits: [],
    studio,
    pressContact: pickPressContact(studio?.contacts, studio),
    socials: list(studio?.contacts).filter((contact) => contact.href),
  };
}

/** Livro / quadrinho. */
export function buildBookPressKit(row, ctx = null) {
  const studio = ctx ?? null;
  const developer = developerOf(row, studio);
  const { tagline, pitch, about } = descriptionLevels(row.short_description, row.description);
  const stores = storeLinks(row.store_pages);

  return {
    kind: "book",
    kindLabel: BOOK_TYPE_LABELS[row.book_type] ?? PRODUCT_KINDS.book.label,
    title: row.title,
    subtitle: text(row.subtitle),
    tagline,
    url: `/quadrinhos/${row.slug}`,
    pressKitUrl: `/quadrinhos/${row.slug}/press-kit`,
    developer,
    factsheet: clean([
      ...baseFactsheet({
        developer,
        releaseDate: formatReleaseDate(row.release_date),
        stageValue: BOOK_STAGE_LABELS[row.stage] ?? text(row.stage),
        rating: ratingLabel(row.content_rating),
      }),
      { label: "Tipo", value: BOOK_TYPE_LABELS[row.book_type] ?? text(row.book_type) },
      { label: "Editora", value: text(row.publisher) },
      { label: "Edição", value: text(row.edition) },
      { label: "Páginas", value: Number(row.pages) > 0 ? String(Number(row.pages)) : null },
      { label: "Idioma", value: text(row.language) },
      { label: "ISBN", value: text(row.isbn) },
      { label: "Preço", value: priceSummary(row.store_pages) },
      { label: "Website", value: text(row.website_url), href: text(row.website_url) },
    ]),
    description: { tagline, pitch, about },
    features: [],
    videos: [],
    images: [],
    assets: cleanAssets([
      { url: row.cover_url, label: "Capa" },
      ...(studio?.logoUrl ? [{ url: studio.logoUrl, label: "Logo do estúdio" }] : []),
    ]),
    storeLinks: stores,
    credits: [],
    studio,
    pressContact: pickPressContact(studio?.contacts, studio),
    socials: list(studio?.contacts).filter((contact) => contact.href),
  };
}

const pressKit = {
  STAGE_LABELS,
  BOOK_STAGE_LABELS,
  GAME_PLATFORM_LABELS,
  BOOK_TYPE_LABELS,
  BOARDGAME_CATEGORY_LABELS,
  PRODUCT_KINDS,
  formatReleaseDate,
  videoEmbed,
  studioContext,
  buildGamePressKit,
  buildBoardgamePressKit,
  buildBookPressKit,
};

export default pressKit;
