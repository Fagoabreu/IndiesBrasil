/**
 * Helpers para gerar as imagens de Open Graph (ver `pages/api/og/**`).
 *
 * As rotas montam um SVG e o rasterizam para **PNG**: o WhatsApp não renderiza
 * SVG em `og:image`, então servir SVG resultava em preview sem imagem nenhuma.
 * O `sharp` já vem no projeto (é o mesmo que o Next usa para otimizar imagens —
 * ver `NEXT_SHARP_PATH` no Dockerfile).
 *
 * As duas rotas (post e perfil) compartilham moldura, gradientes, marca e
 * avatar — antes isso estava só na rota do post, e duplicar aqui faria as duas
 * divergirem no primeiro ajuste visual.
 */

import sharp from "sharp";
import { isSafeUrl } from "@/lib/ssrf-guard";

/** Largura/altura padrão de um preview de link (1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Fonte dos textos do card.
 *
 * "DejaVu Sans" primeiro porque é a fonte que o Dockerfile instala no Alpine —
 * a imagem base do Node não traz nenhuma, e sem fonte instalada o librsvg
 * desenha o SVG inteiro **sem texto**. As demais servem para o card sair igual
 * em ambiente de desenvolvimento (Windows/macOS).
 */
export const SVG_FONT_FAMILY = "DejaVu Sans, Helvetica, Arial, sans-serif";

/**
 * Baixa uma imagem e devolve como data URI, para embutir no SVG.
 *
 * O rasterizador (librsvg, via sharp) **não busca recursos remotos** — uma
 * `<image href="https://...">` sairia em branco. Por isso o avatar é baixado
 * aqui e embutido como base64.
 *
 * Passa pelo guard de SSRF do projeto: a URL vem do banco, mas um dia pode vir
 * de dado de usuário, e sem a checagem isto seria uma porta para ler serviços
 * internos.
 *
 * Devolve null em qualquer falha — o card degrada para a inicial do usuário,
 * que é melhor do que perder o preview inteiro.
 */
export async function fetchAsDataUri(url, { timeoutMs = 5000, maxBytes = 4 * 1024 * 1024 } = {}) {
  if (typeof url !== "string" || !url.startsWith("http")) return null;

  try {
    if (!(await isSafeUrl(url))) return null;

    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;

    const type = res.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!type.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > maxBytes) return null;

    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Rasteriza o SVG do card para PNG — o formato que as redes sociais exibem.
 *
 * `density: 72` para 1 unidade do SVG virar 1 pixel (o padrão do librsvg já é
 * 72, mas deixar explícito evita que o card saia 1600x840, como acontecia com
 * o padrão do sharp). O `resize` é rede de segurança: as páginas anunciam
 * `og:image:width/height` de 1200x630, então o arquivo tem que ter esse tamanho
 * mesmo que o SVG mude.
 */
export async function renderPng(svg) {
  return sharp(Buffer.from(svg), { density: 72 }).resize(OG_WIDTH, OG_HEIGHT, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();
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

/** Cabeçalho comum: moldura, gradientes e faixa da marca. */
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
 *
 * O `clipPath` é emitido aqui dentro, com id derivado das coordenadas: antes
 * ele vivia fixo no `svgHeader` (cx=70 cy=70 r=60), o que só funcionava para a
 * posição/tamanho padrão — mudar `size` ou `x`/`y` cortava o avatar errado.
 */
export function svgAvatar(avatarUrl, username, { x = 80, y = 80, size = 120 } = {}) {
  const initial = escapeXml(
    String(username || "i")
      .charAt(0)
      .toUpperCase(),
  );
  const center = size / 2 + 10;
  const clipId = `avatarClip${x}-${y}-${size}`;

  return [
    `<g transform="translate(${x}, ${y})">`,
    `<clipPath id="${clipId}"><circle cx="${center}" cy="${center}" r="${size / 2}"/></clipPath>`,
    avatarUrl
      ? `<image href="${escapeXml(avatarUrl)}" x="10" y="10" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
      : `<circle cx="${center}" cy="${center}" r="${size / 2}" fill="url(#brand)"/>` +
        `<text x="${center}" y="${center + 18}" text-anchor="middle" fill="white" font-size="50" font-weight="bold" font-family="${SVG_FONT_FAMILY}">${initial}</text>`,
    `<circle cx="${center}" cy="${center}" r="${size / 2}" fill="none" stroke="url(#brand)" stroke-width="5"/>`,
    "</g>",
  ].join("");
}

/** Rodapé com a marca e textura decorativa; fecha o documento. */
export function svgFooter({ tagline = "Comunidade de desenvolvedores indie", brandX = 80 } = {}) {
  return [
    `<text x="${brandX}" y="460" fill="url(#brand)" font-size="26" font-weight="bold" font-family="${SVG_FONT_FAMILY}">Indies Brasil</text>`,
    `<text x="${brandX}" y="500" fill="#666688" font-size="18" font-family="${SVG_FONT_FAMILY}">${escapeXml(tagline)}</text>`,
    '<circle cx="1050" cy="520" r="100" fill="rgba(108,99,255,0.04)"/>',
    '<circle cx="1150" cy="600" r="140" fill="rgba(233,66,245,0.03)"/>',
    "</svg>",
  ].join("");
}

/**
 * Cabeçalhos de resposta para servir o PNG do card.
 *
 * Diferente do SVG, PNG é dado inerte: não precisa de CSP nem `sandbox`.
 */
export function setPngHeaders(res, { maxAge = 86400 } = {}) {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Crawlers de redes sociais não mandam cookie; `public` deixa o CDN/proxy
  // servir o card sem passar pelo app.
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${maxAge}`);
}
