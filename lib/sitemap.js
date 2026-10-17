/**
 * Sitemap — a única lista de endereços que o Google recebe.
 *
 * ## Por que este módulo existe
 *
 * O sitemap antigo listava só as nove rotas fixas (home, feed, membros,
 * ferramentas, cadastro, login). Nenhum estúdio, jogo, jogo de mesa, quadrinho,
 * curso, notícia ou análise estava lá — e, como as listagens montam os cards no
 * cliente a partir de `/api/v1/*`, o HTML servido também não tinha um único
 * `<a href>` para essas páginas. O conjunto de endereços que o Google conhecia
 * era o dessas nove rotas; as entidades só apareceriam se ele executasse
 * JavaScript e descobrisse os links por conta própria.
 *
 * ## Forma: índice + um arquivo por tipo
 *
 * Em vez de um arquivo com tudo, `sitemap.xml` é um **índice** e cada tipo tem
 * o seu filho. O limite do protocolo é 50.000 URLs por arquivo (nenhum tipo
 * chega perto hoje), mas o motivo principal é diagnóstico: no Search Console dá
 * para ver quantas páginas de cada tipo foram descobertas, e uma falha em um
 * tipo não invalida os outros.
 *
 * ## `lastmod` de verdade
 *
 * Vem do `updated_at` da linha — nas organizações, do `created_at`, porque a
 * tabela não tem `updated_at`. O sitemap antigo carimbava `new Date()` em todas
 * as URLs a cada requisição, o que é pior que não ter `lastmod`: o Google
 * compara o valor com o que ele já tinha guardado, e um carimbo que muda sempre
 * sem o conteúdo mudar vira ruído que ele aprende a ignorar.
 *
 * ## O que fica de fora
 *
 * Conteúdo bloqueado pela moderação (o mesmo filtro de `findAll` de cada
 * model), páginas "em construção" e tudo que é `noindex`. Endereço de página
 * que responde 404 ou que pede para não ser indexada não pertence ao sitemap.
 */

import { SITE_URL } from "@/lib/seo";

/** Chave do arquivo com as rotas fixas do site (as que não vêm do banco). */
export const STATIC_SITEMAP_KEY = "estatico";

/**
 * Rotas fixas e suas prioridades/frequências de atualização.
 *
 * São páginas que existem sempre, independentemente de haver conteúdo — por
 * isso não têm `lastmod`: não há coluna de banco que diga quando mudaram.
 */
export const STATIC_ENTRIES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/posts", changefreq: "hourly", priority: "0.9" },
  { path: "/membros", changefreq: "daily", priority: "0.8" },
  { path: "/ferramentas/qrgen", changefreq: "monthly", priority: "0.7" },
  { path: "/ferramentas/imagecrop", changefreq: "monthly", priority: "0.7" },
  { path: "/ferramentas/viewer", changefreq: "monthly", priority: "0.7" },
  { path: "/ferramentas/htmlviewer", changefreq: "monthly", priority: "0.7" },
  { path: "/cadastro", changefreq: "yearly", priority: "0.5" },
  { path: "/login", changefreq: "yearly", priority: "0.4" },
];

/**
 * Um item por tipo de conteúdo: como listar as entidades, como transformar cada
 * linha no endereço público delas e **qual feature autoriza a leitura**.
 *
 * `feature` é a mesma que a listagem e a rota de API do tipo exigem. O sitemap
 * público só publica o que o visitante anônimo pode ler: sem essa checagem, um
 * tipo revogado do anônimo continuaria anunciando endereços que respondem
 * `notFound` (soft 404 no Search Console).
 *
 * `load` importa o model dinamicamente. O import estático arrastaria o pool de
 * conexões do Postgres para o bundle do cliente se alguém importasse este
 * módulo de um componente — e `lib/` é compartilhado. Do lado do servidor o
 * custo é o mesmo: o módulo já estará aquecido depois da primeira chamada.
 */
export const ENTITY_SITEMAPS = [
  {
    key: "estudios",
    name: "Estúdios",
    feature: "read:studio",
    hub: { path: "/estudios", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.7",
    load: async () => (await import("@/models/organization")).default.findAllForSitemap(),
    toPath: (row) => `/estudios/${row.slug}`,
  },
  {
    key: "jogos",
    name: "Jogos",
    feature: "read:game:all",
    hub: { path: "/jogos", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.7",
    load: async () => (await import("@/models/game")).default.findAllForSitemap(),
    toPath: (row) => `/jogos/${row.slug}`,
  },
  {
    key: "jogos-de-mesa",
    name: "Jogos de Mesa",
    feature: "read:boardgame:all",
    hub: { path: "/jogos-de-mesa", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.7",
    load: async () => (await import("@/models/boardgame")).default.findAllForSitemap(),
    toPath: (row) => `/jogos-de-mesa/${row.slug}`,
  },
  {
    key: "quadrinhos",
    name: "Quadrinhos e Livros",
    feature: "read:book:all",
    hub: { path: "/quadrinhos", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.7",
    load: async () => (await import("@/models/book")).default.findAllForSitemap(),
    toPath: (row) => `/quadrinhos/${row.slug}`,
  },
  {
    key: "estudos",
    name: "Cursos",
    feature: "read:course",
    hub: { path: "/estudos", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.6",
    load: async () => (await import("@/models/course")).default.findAllForSitemap(),
    toPath: (row) => `/estudos/${row.slug}`,
  },
  {
    key: "noticias",
    name: "Notícias",
    feature: "read:news:all",
    hub: { path: "/noticias", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.6",
    load: async () => (await import("@/models/news")).default.findAllForSitemap(),
    toPath: (row) => `/noticias/${row.id}`,
  },
  {
    key: "analises",
    name: "Análises",
    feature: "read:content_review:all",
    hub: { path: "/analises", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.6",
    load: async () => (await import("@/models/content-review")).default.findAllForSitemap(),
    toPath: (row) => `/analises/${row.slug}`,
  },
  {
    key: "agenda",
    name: "Agenda",
    // Só eventos públicos: `findAllForSitemap` de `models/event.js` filtra
    // `visibility = 'public'` e `status = 'published'`. As REUNIÕES de estúdio
    // ficam fora de propósito — são privadas, vivem em outra tabela
    // (`meetings`) e a página delas é `noIndex` fixo.
    feature: "read:event",
    hub: { path: "/agenda", changefreq: "daily", priority: "0.8" },
    changefreq: "weekly",
    priority: "0.6",
    load: async () => (await import("@/models/event")).default.findAllForSitemap(),
    toPath: (row) => `/agenda/${row.id}`,
  },
  {
    key: "streams",
    name: "Streams",
    // Mesma feature da rota espelhada (`GET /api/v1/streams`) e da listagem.
    feature: "read:studio",
    hub: { path: "/streams", changefreq: "daily", priority: "0.7" },
    // Entra o estúdio que tem canal cadastrado, e não só quem está
    // transmitindo: a página `/streams/<estúdio>` publica o estado offline
    // também, e é o endereço que circula em link.
    //
    // Sem `lastmod`: `findAllForSitemap` de `models/stream.js` não devolve
    // `updated_at` de propósito — a única data que muda nessa página é o status
    // ao vivo, reescrito a cada verificação.
    changefreq: "daily",
    priority: "0.6",
    load: async () => (await import("@/models/stream")).default.findAllForSitemap(),
    toPath: (row) => `/streams/${row.slug}`,
  },
];

/** Config de um tipo, ou `null` quando a chave não existe. */
export function entitySitemapFor(key) {
  return ENTITY_SITEMAPS.find((entry) => entry.key === key) || null;
}

/**
 * Caminho público do arquivo de cada tipo.
 *
 * O arquivo estático também é um filho (`/sitemap/estatico.xml`) e não o
 * próprio índice: um índice de sitemaps não pode listar a si mesmo — o Google
 * recusa o arquivo inteiro com "Sitemap index file cannot contain itself".
 */
export function sitemapPathFor(key) {
  return `/sitemap/${key}.xml`;
}

/** Todas as chaves válidas, na ordem em que o índice as publica. */
export function sitemapKeys() {
  return [STATIC_SITEMAP_KEY, ...ENTITY_SITEMAPS.map((entry) => entry.key)];
}

/**
 * Escapa texto para XML.
 *
 * Os dados que entram aqui são slugs e UUIDs (só `[a-z0-9-]`), que nunca
 * precisariam de escape. O escape existe porque a única coisa que separa um
 * sitemap válido de um XML quebrado — que o Google descarta inteiro — é a
 * origem do dado: no dia em que um endereço passar a aceitar `&` ou `"`, a
 * falha apareceria como "sitemap não processado", sem apontar para a linha.
 */
function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

/**
 * Converte um timestamp do banco na data que o `<lastmod>` aceita (ISO 8601).
 * Devolve `null` quando o valor não é uma data válida — um `lastmod` inválido
 * invalida a URL, então é melhor omitir a tag.
 */
export function toLastmod(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Monta um `<url>` do sitemap; tags sem valor são omitidas. */
export function buildUrlEntry({ path, lastmod, changefreq, priority }) {
  const lines = [`    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (priority) lines.push(`    <priority>${escapeXml(priority)}</priority>`);

  return `  <url>\n${lines.join("\n")}\n  </url>`;
}

/** Envelopa os `<url>` no `<urlset>`. */
export function buildUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
}

/**
 * Monta o índice.
 *
 * Sem `<lastmod>` de propósito: o índice muda quando um arquivo filho é
 * criado, e não a cada vez que um conteúdo é atualizado. Carimbar a hora da
 * requisição faria o índice parecer novo em toda visita, que é o mesmo ruído
 * que tirou o `lastmod` das URLs. O filho é quem carrega a data que importa.
 */
export function buildSitemapIndex(keys) {
  const entries = keys.map((key) => `  <sitemap>\n    <loc>${escapeXml(`${SITE_URL}${sitemapPathFor(key)}`)}</loc>\n  </sitemap>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>`;
}

/** Valor de cache compartilhado pelo índice e pelos arquivos filhos. */
export const SITEMAP_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Escreve o XML na resposta.
 *
 * Índice e filhos precisam exatamente dos mesmos cabeçalhos; manter isso em um
 * lugar só evita que um deles ganhe `charset` ou cache diferente do outro — o
 * índice apontando para um filho que responde com outro `Content-Type` é uma
 * falha que só aparece no Search Console, dias depois.
 */
export function sendSitemapXml(res, xml) {
  res.setHeader("Content-Type", "text/xml; charset=UTF-8");
  res.setHeader("Cache-Control", SITEMAP_CACHE_CONTROL);
  res.write(xml);
  res.end();
}

/**
 * Monta o arquivo de um tipo.
 *
 * Devolve `null` para chave desconhecida: a rota responde 404 em vez de servir
 * um `<urlset>` vazio, que o Google registraria como sitemap válido sem
 * endereço nenhum.
 *
 * A checagem de `feature` **não** mora aqui: `lib/` não conhece o controller, e
 * a rota (`pages/sitemap/[type].js`) faz o gate antes de chamar esta função.
 */
export async function buildSitemapFor(key) {
  if (key === STATIC_SITEMAP_KEY) {
    return buildUrlset(STATIC_ENTRIES.map((route) => buildUrlEntry(route)));
  }

  const config = entitySitemapFor(key);
  if (!config) return null;

  const rows = await config.load();

  const entries = [
    buildUrlEntry(config.hub),
    ...rows.map((row) =>
      buildUrlEntry({
        path: config.toPath(row),
        lastmod: toLastmod(row.updated_at),
        changefreq: config.changefreq,
        priority: config.priority,
      }),
    ),
  ];

  return buildUrlset(entries);
}
