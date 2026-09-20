/**
 * Helpers para gerar as imagens de Open Graph em SVG (ver `pages/api/og/**`).
 *
 * As duas rotas (post e perfil) compartilham moldura, gradientes, marca e
 * avatar — antes isso estava só na rota do post, e duplicar aqui faria as duas
 * divergirem no primeiro ajuste visual.
 */

import { SITE_URL } from "@/lib/seo";

/** Largura/altura padrão de um preview de link (1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Origem para as rotas de OG chamarem a própria API no servidor.
 *
 * Sem isso elas usariam `SITE_URL`, que em desenvolvimento aponta para produção
 * (o env só é definido no deploy) — o teste local iria buscar dados no site no
 * ar. Aqui a chamada fica no próprio host que recebeu a requisição.
 *
 * ⚠️ O `Host` vem do cliente, então aceitamos **apenas** localhost/127.0.0.1
 * ou o host de `SITE_URL`. Sem essa checagem, um `Host` forjado faria o
 * servidor buscar um domínio arbitrário (SSRF).
 */
export function resolveInternalOrigin(req) {
  const host = req?.headers?.host;
  if (!host || !isTrustedHost(host)) return SITE_URL;

  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `${isLocal ? "http" : "https"}://${host}`;
}

function isTrustedHost(host) {
  try {
    return host === new URL(SITE_URL).host || host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  } catch {
    return false;
  }
}

/**
 * Escapa texto para interpolação segura em SVG.
 *
 * Sem isso, um `username` ou trecho de post contendo `<`, `&` ou aspas quebra o
 * documento — o SVG é XML, não HTML tolerante.
 */
export function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Quebra o texto em linhas de até `maxChars`, limitado a `maxLines`. */
export function wrapText(text, maxChars, maxLines) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  const lines = [];
  let rest = clean;

  while (rest && lines.length < maxLines) {
    if (rest.length <= maxChars) {
      lines.push(rest);
      rest = "";
      break;
    }

    // Corta no último espaço antes do limite para não partir palavra no meio.
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;

    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }

  if (rest && lines.length > 0) {
    // Última linha recebe reticências, sem pontuação solta antes dela.
    // O corte é feito caractere a caractere (em vez de `replace(/…+$/)`) para
    // não depender de regex com quantificador no fim da string.
    let last = lines.at(-1);
    while (last.length > 0 && " \t\n,.;:".includes(last.at(-1))) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}

/** Cabeçalho comum: moldura, gradientes e clip do avatar circular. */
export function svgHeader(extraDefs = "") {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">`,
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
    extraDefs,
    "</defs>",
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" rx="24"/>`,
    '<rect width="1200" height="6" fill="url(#brand)" rx="3"/>',
  ].join("");
}

/**
 * Avatar circular com anel na cor da marca.
 *
 * Sem `avatarUrl`, desenha um disco com a inicial — nunca deixa o espaço vazio,
 * porque um preview sem imagem é pior do que um com inicial.
 */
export function svgAvatar(avatarUrl, username, { x = 80, y = 80, size = 120 } = {}) {
  const initial = escapeXml(
    String(username || "i")
      .charAt(0)
      .toUpperCase(),
  );
  const center = size / 2;

  return [
    `<g transform="translate(${x}, ${y})">`,
    avatarUrl
      ? `<image href="${escapeXml(avatarUrl)}" x="10" y="10" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
      : `<circle cx="${center}" cy="${center}" r="${center - 10}" fill="url(#brand)"/>` +
        `<text x="${center}" y="${center + 18}" text-anchor="middle" fill="white" font-size="50" font-weight="bold" font-family="sans-serif">${initial}</text>`,
    `<circle cx="${center}" cy="${center}" r="${center - 10}" fill="none" stroke="url(#brand)" stroke-width="5"/>`,
    "</g>",
  ].join("");
}

/** Rodapé com a marca e textura decorativa; fecha o documento. */
export function svgFooter({ tagline = "Comunidade de desenvolvedores indie", brandX = 80 } = {}) {
  return [
    `<text x="${brandX}" y="460" fill="url(#brand)" font-size="26" font-weight="bold" font-family="sans-serif">Indies Brasil</text>`,
    `<text x="${brandX}" y="500" fill="#666688" font-size="18" font-family="sans-serif">${escapeXml(tagline)}</text>`,
    '<circle cx="1050" cy="520" r="100" fill="rgba(108,99,255,0.04)"/>',
    '<circle cx="1150" cy="600" r="140" fill="rgba(233,66,245,0.03)"/>',
    "</svg>",
  ].join("");
}

/**
 * Cabeçalhos de resposta para servir SVG com segurança.
 *
 * SVG é documento executável: sem `nosniff` e CSP, um SVG contendo `<script>`
 * rodaria na nossa origem se aberto diretamente pelo navegador.
 */
export function setSvgHeaders(res, { maxAge = 3600 } = {}) {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${maxAge}`);
}
