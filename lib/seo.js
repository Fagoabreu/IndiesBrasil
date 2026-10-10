// Centraliza constantes e helpers de SEO para o projeto.
// O domínio é definido via variável de ambiente; ajuste NEXT_PUBLIC_SITE_URL no .env.local.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://jogos.social.br";
export const SITE_NAME = "Indies Brasil";
export const SITE_LOCALE = "pt_BR";
/**
 * Arte do site — o MESMO desenho em dois arquivos, porque as superfícies que a
 * mostram têm exigências opostas.
 *
 * `og-cover.jpg` é a capa padrão dos previews de link (`DEFAULT_OG_IMAGE`),
 * usada por toda página que não informa `ogImage` — a home e as listagens
 * (jogos, estúdios, agenda, notícias, membros, loja, streams...). É um arquivo
 * estático, e não uma rota em `pages/api/og/**`, porque não desenha dado de
 * nenhuma entidade: é a marca fixa do site. As redes recortam o preview em
 * 1,91:1, e é por isso que o arquivo já vem nesse formato: a moldura da arte
 * fica centralizada e a sobra escura nas laterais é justamente o que impede o
 * recorte de comer a moldura. Opaco e em JPEG porque preview de link tem limite
 * de tamanho.
 *
 * `og-cover.png` é a mesma arte (mesmo canvas e mesmas medidas) para a home.
 * Lá a sobra lateral não tem função nenhuma e, opaca, aparecia como faixa branca
 * dentro do card — em PNG ela é transparente e o CSS do card (`.promoCard`,
 * `pages/index.module.css`) a descarta, cortando por igual dos dois lados e
 * mostrando a moldura da arte inteira.
 */
export const OG_COVER_IMAGE = "/images/og-cover.jpg";
export const DEFAULT_OG_IMAGE = `${SITE_URL}${OG_COVER_IMAGE}`;
export const OG_COVER_ART = "/images/og-cover.png";
export const TWITTER_HANDLE = "@indiesbrasil";

/**
 * Medidas do canvas dos dois arquivos da arte do site — e as superfícies que
 * dependem delas.
 *
 * O `SeoHead` publica os dois números em `og:image:width/height`; as redes
 * dimensionam o card **antes** de baixar a imagem, então um número que não bate
 * com o arquivo faz a imagem aparecer esticada ou recortada. A home usa os
 * mesmos números no `<Image>`, que é o que reserva a caixa antes de a imagem
 * carregar — divergir ali aparece como layout shift.
 *
 * A sobra lateral é transparente no PNG e escura no JPEG, mas o canvas é o mesmo
 * nos dois: `scripts/audit-image-presets.js` confere as medidas e a proporção de
 * card contra os arquivos, e confere também o recorte do card da home contra o
 * conteúdo do PNG. Antes apontava para `/images/og-cover.png`, que **não
 * existia** — respondia 404 em produção e todas essas páginas eram
 * compartilhadas sem imagem nenhuma.
 */
export const OG_IMAGE_SIZE = { width: 1424, height: 747 };

/**
 * Retorna o objeto de metadados base para uma página.
 * @param {{ title: string, description: string, canonical: string, ogImage?: string }} opts
 */
export function buildMeta({ title, description, canonical, ogImage }) {
  return {
    title,
    description,
    canonical: `${SITE_URL}${canonical}`,
    ogImage: ogImage || DEFAULT_OG_IMAGE,
  };
}

/* =====================
 * Posts
 * ===================== */

/**
 * Texto usado quando o post não tem conteúdo escrito (post só de imagem/embed).
 *
 * Compartilhado com o card de imagem (`pages/api/og/post/[id].js`): o texto que
 * o card desenha e o que os metadados publicam precisam ser o mesmo, senão a
 * prévia do link e a imagem contam coisas diferentes.
 */
export const POST_CONTENT_FALLBACK = "Confira este post no Indies Brasil!";

/** Limite do título do preview — o WhatsApp corta por volta disso. */
const POST_TITLE_MAX = 100;
/** Limite da descrição do preview. */
const POST_DESCRIPTION_MAX = 200;
/**
 * Quanto a descrição precisa acrescentar além do título para valer a pena.
 * Abaixo disso ela repetiria quase a mesma frase na linha de baixo.
 */
const POST_DESCRIPTION_MIN_EXTRA = 30;

/** Autor do post como `@handle`; vazio quando o dado não existe. */
function postAuthor(post) {
  const username = String(post?.author_username || "").trim();
  return username ? `@${username}` : "";
}

/** Verdadeiro quando o post tem texto próprio (não é só imagem/embed). */
function hasText(post) {
  return Boolean(String(post?.content || "").trim());
}

/**
 * Texto do post, com espaços normalizados.
 *
 * Serve para os metadados e para o card desenharem o mesmo conteúdo.
 */
export function postText(post) {
  const text = String(post?.content || "")
    .replace(/\s+/g, " ")
    .trim();
  return text || POST_CONTENT_FALLBACK;
}

/** Corta o texto no último espaço antes de `max`, sem deixar pontuação solta. */
function truncate(text, max) {
  if (text.length <= max) return text;

  let cut = text.lastIndexOf(" ", max);
  if (cut <= 0) cut = max;

  let head = text.slice(0, cut);
  while (head.length > 0 && " \t,.;:!?…".includes(head.at(-1))) {
    head = head.slice(0, -1);
  }

  return `${head}…`;
}

/** Linha que diz de quem é a publicação, usada como descrição. */
function provenance(post) {
  const author = postAuthor(post);
  return author ? `Por ${author} no Indies Brasil.` : "Na comunidade Indies Brasil.";
}

/**
 * Título do preview de um post.
 *
 * O título identifica a **publicação**: é o próprio conteúdo do post. Usar
 * `@username` aqui (como era antes) fazia a prévia do link falar do autor em vez
 * do post — e o autor já aparece em destaque na imagem do card
 * (`pages/api/og/post/[id].js`).
 */
export function postMetaTitle(post) {
  if (!hasText(post)) {
    const author = postAuthor(post);
    return author ? `Publicação de ${author}` : "Publicação no Indies Brasil";
  }

  return truncate(postText(post), POST_TITLE_MAX);
}

/**
 * Descrição do preview de um post.
 *
 * Quando o conteúdo é longo o bastante para render uma segunda linha, a
 * descrição é o trecho do post. Quando ele caberia quase inteiro no título, a
 * descrição só diz de quem é a publicação — repetir a mesma frase nas duas
 * linhas deixa a prévia com texto duplicado.
 */
export function postMetaDescription(post) {
  if (!hasText(post)) return provenance(post);

  const text = postText(post);
  const titulo = truncate(text, POST_TITLE_MAX);
  const trecho = truncate(text, POST_DESCRIPTION_MAX);

  return trecho.length >= titulo.length + POST_DESCRIPTION_MIN_EXTRA ? trecho : provenance(post);
}
