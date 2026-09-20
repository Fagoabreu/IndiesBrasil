/**
 * OG Image API para compartilhamento de posts no WhatsApp / Discord / redes sociais.
 *
 * Estratégia:
 * - Post COM imagem: redireciona (302) para a imagem real do post.
 *   WhatsApp e outras plataformas seguem o redirect e exibem a foto.
 * - Post SEM imagem: gera um SVG estilizado com avatar, @username,
 *   trecho do conteúdo e a marca Indies Brasil.
 *
 * A moldura do card, os gradientes e o avatar vêm de `lib/og-image.js` — os
 * mesmos usados pelo card de perfil (`pages/api/og/profile/[username].js`).
 *
 * Cache: 24h para fotos, 1h para SVG.
 * Acesso: público (sem autenticação).
 */

import { escapeXml, resolveInternalOrigin, setSvgHeaders, svgAvatar, svgFooter, svgHeader, wrapText } from "@/lib/og-image";

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const origin = resolveInternalOrigin(req);
    const apiUrl = `${origin}/api/v1/posts/${id}`;
    const apiRes = await fetch(apiUrl);

    if (!apiRes.ok) {
      return res.status(404).end();
    }

    const post = await apiRes.json();

    // Post com imagem → redireciona para ela (melhor preview possível)
    if (isSafeRedirectTarget(post.post_img_url)) {
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.statusCode = 302;
      res.setHeader("Location", post.post_img_url);
      return res.end();
    }

    // Sem imagem → SVG estilizado
    setSvgHeaders(res);
    return res.status(200).send(renderSvg(post));
  } catch {
    return res.status(500).end();
  }
}

// ── SVG renderer ──────────────────────────────────────────────

/**
 * Só redireciona para HTTPS em hosts conhecidos. Hoje `post_img_url` vem de
 * `uploaded_images.secure_url` (Cloudinary, gerado no servidor), mas validar
 * antes do `Location` evita que uma origem futura transforme este endpoint
 * em open redirect.
 * @param {unknown} value
 * @returns {boolean}
 */
function isSafeRedirectTarget(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  return host === "res.cloudinary.com" || host.endsWith(".cloudinary.com");
}
function renderSvg(post) {
  const username = String(post.author_username || "indiesbrasil");
  const avatar = String(post.author_avatar_url || "");
  const content = String(post.content || "Confira este post no Indies Brasil!");
  const lines = wrapText(content, 90, 2);

  return [
    svgHeader(),
    svgAvatar(avatar, username),

    `<text x="240" y="130" fill="white" font-size="38" font-weight="bold" font-family="sans-serif">@${escapeXml(username)}</text>`,

    // Trecho do conteúdo (até 2 linhas)
    ...lines.map(
      (line, index) => `<text x="80" y="${280 + index * 45}" fill="#c8c8dc" font-size="28" font-family="sans-serif">${escapeXml(line)}</text>`,
    ),

    '<line x1="80" y1="400" x2="1120" y2="400" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>',

    svgFooter({ brandX: 80 }),
  ].join("");
}
