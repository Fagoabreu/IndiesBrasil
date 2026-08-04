/**
 * OG Image API para compartilhamento no WhatsApp / Discord / redes sociais.
 *
 * Estratégia:
 * - Post COM imagem: redireciona (302) para a imagem real do post.
 *   WhatsApp e outras plataformas seguem o redirect e exibem a foto.
 * - Post SEM imagem: gera um SVG estilizado com avatar, @username,
 *   trecho do conteúdo e a marca Indies Brasil.
 *
 * Cache: 24h para fotos, 1h para SVG.
 * Acesso: público (sem autenticação).
 */

import { SITE_URL } from "@/lib/seo";

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const apiUrl = `${SITE_URL}/api/v1/posts/${id}`;
    const apiRes = await fetch(apiUrl);

    if (!apiRes.ok) {
      return res.status(404).end();
    }

    const post = await apiRes.json();

    // Post com imagem → redireciona para ela (melhor preview possível)
    if (post.post_img_url) {
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.statusCode = 302;
      res.setHeader("Location", post.post_img_url);
      return res.end();
    }

    // Sem imagem → SVG estilizado
    const svg = renderSvg(post);

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.status(200).send(svg);
  } catch {
    return res.status(500).end();
  }
}

// ── SVG renderer ──────────────────────────────────────────────

function renderSvg(post) {
  const username = esc(String(post.author_username || "indiesbrasil"));
  const avatar = esc(String(post.author_avatar_url || ""));
  const content = esc(String((post.content || "Confira este post no Indies Brasil!").slice(0, 180)));
  const truncated = post.content && post.content.length > 180;

  // Quebra o texto em duas linhas se necessário
  const line1 = content.slice(0, 90);
  const line2 = content.slice(90, 180);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">',
    "<defs>",
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0%" stop-color="#0f0c29"/>',
    '<stop offset="50%" stop-color="#1a1a2e"/>',
    '<stop offset="100%" stop-color="#16213e"/>',
    "</linearGradient>",
    '<linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">',
    '<stop offset="0%" stop-color="#6c63ff"/>',
    '<stop offset="100%" stop-color="#e942f5"/>',
    "</linearGradient>",
    '<clipPath id="avatarClip"><circle cx="70" cy="70" r="60"/></clipPath>',
    "</defs>",
    // Background
    '<rect width="1200" height="630" fill="url(#bg)" rx="24"/>',
    // Accent bar
    '<rect width="1200" height="6" fill="url(#brand)" rx="3"/>',
    // Avatar
    '<g transform="translate(80, 80)">',
    avatar
      ? `<image href="${avatar}" x="10" y="10" width="120" height="120" clip-path="url(#avatarClip)"/>`
      : `<circle cx="70" cy="70" r="60" fill="url(#brand)"/><text x="70" y="85" text-anchor="middle" fill="white" font-size="50" font-weight="bold" font-family="sans-serif">${username[0].toUpperCase()}</text>`,
    '<circle cx="70" cy="70" r="60" fill="none" stroke="url(#brand)" stroke-width="5"/>',
    "</g>",
    // Username
    `<text x="240" y="130" fill="white" font-size="38" font-weight="bold" font-family="sans-serif">@${username}</text>`,
    // Content line 1
    `<text x="80" y="280" fill="#c8c8dc" font-size="28" font-family="sans-serif"><tspan x="80">${line1}</tspan></text>`,
    // Content line 2
    line2
      ? `<text x="80" y="325" fill="#c8c8dc" font-size="28" font-family="sans-serif"><tspan x="80">${line2}${truncated ? "…" : ""}</tspan></text>`
      : "",
    // Divider
    '<line x1="80" y1="400" x2="1120" y2="400" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>',
    // Brand
    '<text x="80" y="460" fill="url(#brand)" font-size="26" font-weight="bold" font-family="sans-serif">Indies Brasil</text>',
    '<text x="80" y="500" fill="#666688" font-size="18" font-family="sans-serif">Comunidade de desenvolvedores indie</text>',
    // Decorative
    '<circle cx="1050" cy="520" r="100" fill="rgba(108,99,255,0.04)"/>',
    '<circle cx="1150" cy="600" r="140" fill="rgba(233,66,245,0.03)"/>',
    "</svg>",
  ].join("");
}

function esc(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
