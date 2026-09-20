// Centraliza constantes e helpers de SEO para o projeto.
// O domínio é definido via variável de ambiente; ajuste NEXT_PUBLIC_SITE_URL no .env.local.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://jogos.social.br";
export const SITE_NAME = "Indies Brasil";
export const SITE_LOCALE = "pt_BR";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-cover.png`;
export const TWITTER_HANDLE = "@indiesbrasil";

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
