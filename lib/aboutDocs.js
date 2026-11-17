/**
 * Documentos de "Sobre" — os arquivos de `docs/` publicados dentro do site.
 *
 * ## Por que um registro e não dois links escritos na sidebar
 *
 * A mesma informação é usada por dois lugares: a rota `/sobre/[slug]` (que
 * precisa do nome do arquivo e do título) e o menu lateral (que precisa do
 * rótulo e do endereço). Duas listas divergiriam — um link novo apareceria no
 * menu e responderia 404, ou o inverso — e é exatamente o tipo de divergência
 * que ninguém percebe até clicar.
 *
 * ## Por que a lista é fechada (allowlist)
 *
 * O `slug` vem da URL. Montar o caminho com ele direto (`docs/${slug}.md`)
 * permitiria `../../.env` — leitura de arquivo arbitrário por quem só digitasse
 * a URL. Aqui o slug é **procurado** na lista: o que não está nela não abre
 * arquivo nenhum, e a página responde 404 antes de tocar no disco.
 *
 * ## Por que o Markdown é lido em tempo de build
 *
 * Os documentos são versionados junto com o código, então eles não mudam entre
 * um request e outro: `getStaticProps` gera o HTML no build. Isso também evita
 * depender do `output: "standalone"` copiar a pasta `docs/` para a imagem de
 * produção — `fs.readFile` em caminho montado em runtime não é rastreável pelo
 * file tracing do Next, e a página responderia 500 só em produção.
 */

/**
 * Documentos publicados em `/sobre/<slug>`.
 *
 * `file` é relativo a `docs/`. `summary` alimenta o índice e a descrição do
 * `SeoHead`; não é o primeiro parágrafo do arquivo (que muda sem aviso).
 */
export const ABOUT_DOCS = [
  {
    slug: "funcionalidades",
    file: "funcionalidades.md",
    title: "Funcionalidades",
    summary: "Inventário de tudo o que a plataforma faz hoje, módulo por módulo, com as rotas de cada área e os limites conhecidos.",
  },
  {
    slug: "roadmap",
    file: "roadmap.md",
    title: "Roadmap",
    summary: "O plano de evolução em cinco fases (2025 a 2029), com o que já está pronto, o que falta e o que trava cada fase.",
  },
];

/** Ordem de exibição — a mesma do menu e do índice. */
export const ABOUT_DOC_SLUGS = ABOUT_DOCS.map((doc) => doc.slug);

/**
 * Um documento pelo slug, ou `null`.
 *
 * Nunca lança: `null` é a resposta para "esse endereço não é um documento", e
 * quem chama decide entre 404 e lista.
 */
export function getAboutDoc(slug) {
  if (typeof slug !== "string") return null;
  return ABOUT_DOCS.find((doc) => doc.slug === slug) ?? null;
}

/** Caminho de cada documento, para `getStaticPaths`. */
export function aboutDocPaths() {
  return ABOUT_DOCS.map((doc) => ({ params: { slug: doc.slug } }));
}

/**
 * Resolve os links `./outro-documento.md` que os próprios arquivos usam entre si.
 *
 * Os documentos foram escritos para serem lidos no repositório, onde `./roadmap.md`
 * é um link válido. Servidos no site, esse mesmo `href` vira uma **rota do site**
 * (`/sobre/funcionalidades/roadmap.md`), ou seja, um 404 que parece link quebrado.
 *
 * Duas saídas, e a escolha entre elas é o ponto:
 *
 *  - documento publicado em `/sobre` → vira o endereço dele;
 *  - documento **não** publicado (roteiro de vídeo, rascunho interno) → o link é
 *    desfeito e o texto fica. É a mesma regra dos contatos: link que não leva a
 *    lugar nenhum é pior que texto sem link, porque promete navegação e entrega
 *    erro. Publicar por tabela tudo o que é citado transformaria o menu num
 *    despejo de notas internas.
 *
 * Roda sobre o HTML **já sanitizado**, e só reescreve `href` relativo terminando
 * em `.md` — nenhum endereço externo ou absoluto é tocado.
 */
export function resolveDocLinks(html) {
  return String(html ?? "").replace(/<a\b([^>]*?)href="(?:\.\/)?([a-z0-9-]+)\.md"([^>]*)>([\s\S]*?)<\/a>/gi, (match, before, slug, after, text) => {
    const doc = getAboutDoc(slug);
    if (!doc) return text;

    // Os atributos que não são `href` são preservados (o `annotateLinks` do
    // `lib/markdown.js` não põe nada em link interno, mas manter é mais seguro
    // que reconstruir a tag a partir de nada).
    return `<a${before}href="/sobre/${doc.slug}"${after}>${text}</a>`;
  });
}

/**
 * Remove o `<h1>` do topo do documento.
 *
 * Os dois arquivos começam com `# Título`, e o `PageHeader` da página já desenha
 * esse título — sem isso a mesma frase aparece duas vezes (uma no cabeçalho,
 * outra logo abaixo) e a página fica com dois `<h1>`, que é o que o leitor de
 * tela anuncia como "título nível 1" duas vezes.
 *
 * Só remove quando o `<h1>` é o **primeiro** elemento: um `<h1>` no meio do
 * texto é conteúdo, não cabeçalho de página, e apagá-lo sumiria com informação.
 */
export function stripDocTitle(html) {
  return String(html ?? "").replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

const aboutDocs = {
  ABOUT_DOCS,
  ABOUT_DOC_SLUGS,
  getAboutDoc,
  aboutDocPaths,
  resolveDocLinks,
  stripDocTitle,
};

export default aboutDocs;
