/**
 * Reconhecimento e normalização de links de plataformas que têm embed próprio.
 *
 * Fica em `lib/` porque os **dois lados** precisam da mesma regra: o resolvedor
 * do servidor (`infra/embededResolver.js`, que grava o embed no post) e o
 * componente que desenha (`components/Embeds`), que precisa reconhecer embeds
 * antigos já gravados com o tipo errado. Duas cópias divergiriam — e divergir
 * aqui aparece como card quebrado, não como erro.
 *
 * Nada aqui faz rede: é só análise da URL.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/;

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Host sem `www.`/`m.`/`music.`, para comparar sem depender da forma digitada. */
function hostOf(parsed) {
  return parsed.hostname.toLowerCase().replace(/^(?:www|m|music)\./, "");
}

/**
 * ID do vídeo do YouTube, ou `null` quando a URL não é de um vídeo.
 *
 * Cobre as formas que as pessoas colam: `watch?v=`, `youtu.be/`, e os caminhos
 * `/live/`, `/shorts/`, `/embed/` e `/v/`. Faltava `/live/` — o link de
 * transmissão ao vivo (`youtube.com/live/<id>`, o que a própria página "ao vivo"
 * copia) não era reconhecido, caía em `fetchLinkPreview` e o post ficava com um
 * card de preview **sem imagem**, porque o YouTube não serve o HTML do vídeo
 * para uma requisição de servidor.
 *
 * Devolve `null` para canal, playlist e busca: são páginas, não vídeo — e é
 * justamente o preview delas que interessa.
 */
export function youtubeVideoId(url) {
  const parsed = parse(url);
  if (!parsed) return null;

  const host = hostOf(parsed);

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID.test(id) ? id : null;
  }

  if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;

  const fromQuery = parsed.searchParams.get("v");
  if (fromQuery) return YOUTUBE_ID.test(fromQuery) ? fromQuery : null;

  const fromPath = parsed.pathname.match(/^\/(?:live|shorts|embed|v)\/([^/]+)/);
  return fromPath && YOUTUBE_ID.test(fromPath[1]) ? fromPath[1] : null;
}

/** É Short (vertical, 9:16)? Muda só a proporção do container. */
export function isYoutubeShort(url) {
  const parsed = parse(url);
  return Boolean(parsed) && /^\/shorts\//.test(parsed.pathname);
}

/**
 * Permalink canônico de uma publicação do Instagram, ou `null`.
 *
 * O Instagram publica o mesmo conteúdo em duas formas de caminho, e **só uma
 * responde ao embed**: `/reel/<id>` devolve 200 em
 * `/embed/captioned/`, `/reels/<id>` devolve **404** (verificado). O link que o
 * app do Instagram compartilha é o `/reels/` (plural), então o embed aparecia
 * como um espaço vazio — `embed.js` recebia um permalink que não existe.
 *
 * Normalizar aqui, e não no componente, mantém a regra num lugar só: o servidor
 * grava o permalink já correto e o componente conserta o que foi gravado antes.
 */
export function normalizeInstagramUrl(url) {
  const parsed = parse(url);
  if (!parsed) return null;

  if (hostOf(parsed) !== "instagram.com") return null;

  const match = parsed.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;

  // `/reels/` (plural, do compartilhamento) vira `/reel/` (singular, do embed).
  const kind = match[1] === "reels" ? "reel" : match[1];

  // A barra final é a forma do markup oficial do embed; query string de
  // rastreio (`?igsh=`) é descartada — não faz parte do permalink.
  return `https://www.instagram.com/${kind}/${match[2]}/`;
}
