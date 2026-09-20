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
 *
 * ## Zona segura (importante)
 *
 * Cada rede recorta o `og:image` de um jeito, e o WhatsApp é o mais agressivo:
 * em vez do card inteiro ele mostra um **quadrado recortado do centro**. Com a
 * composição antiga (avatar à esquerda, QR à direita) esse recorte pegava só
 * pedaços de texto — o preview virava um retângulo escuro ilegível.
 *
 * Por isso todo o conteúdo informativo vive dentro do **quadrado central**
 * ({@link OG_SAFE}); as laterais são só decoração. No corte quadrado o card
 * aparece completo; num preview largo o que sobra são as margens.
 */

import sharp from "sharp";
import { isSafeUrl } from "@/lib/ssrf-guard";

/** Largura/altura padrão de um preview de link (1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Quadrado central que nenhum recorte de rede social corta.
 *
 * O lado é a altura do card (630) — um recorte quadrado sempre cabe na imagem
 * inteira — e ele fica centrado na horizontal.
 */
export const OG_SAFE = {
  left: (OG_WIDTH - OG_HEIGHT) / 2,
  size: OG_HEIGHT,
  centerX: OG_WIDTH / 2,
};

/** Largura útil para texto dentro da zona segura (com folga nas laterais). */
export const SAFE_TEXT_WIDTH = 560;

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
 * Cores da marca, iguais a `css/styles.css :root`.
 *
 * Duplicadas aqui porque são pintadas dentro do SVG rasterizado — o card não
 * tem acesso às CSS variables do site.
 */
const BRAND_PRIMARY = "#8b5cf6";
const BRAND_SECONDARY = "#e879b8";

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

/**
 * Cabeçalho comum: gradiente da marca, brilhos e recorte arredondado.
 *
 * O `<g clip-path>` aberto aqui é fechado no `svgFooter` — é ele que faz a
 * imagem do post, quando existe, ganhar os cantos arredondados do card.
 */
export function svgHeader(extraDefs = "") {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">`,
    "<defs>",
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    // Violeta claro o bastante para o thumbnail não virar um quadrado preto.
    '<stop offset="0%" stop-color="#241347"/>',
    '<stop offset="55%" stop-color="#321a63"/>',
    '<stop offset="100%" stop-color="#4a2478"/>',
    "</linearGradient>",
    '<linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">',
    `<stop offset="0%" stop-color="${BRAND_PRIMARY}"/>`,
    `<stop offset="100%" stop-color="${BRAND_SECONDARY}"/>`,
    "</linearGradient>",
    `<clipPath id="cardClip"><rect width="${OG_WIDTH}" height="${OG_HEIGHT}" rx="24"/></clipPath>`,
    extraDefs,
    "</defs>",
    '<g clip-path="url(#cardClip)">',
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>`,
    // Brilhos da marca nas laterais: só decoração, ficam fora da zona segura.
    '<circle cx="120" cy="80" r="220" fill="rgba(139,92,246,0.16)"/>',
    '<circle cx="1090" cy="570" r="250" fill="rgba(232,121,184,0.12)"/>',
    `<rect width="${OG_WIDTH}" height="8" fill="url(#brand)"/>`,
  ].join("");
}

/**
 * Texto do card, centralizado na zona segura por padrão.
 *
 * Existe para não repetir `text-anchor`/`font-family` em cada linha: o card tem
 * dezenas de `<text>`, e um `font-family` esquecido sai sem fonte nenhuma no
 * Alpine (ver `SVG_FONT_FAMILY`).
 */
export function svgText({ content, x = OG_SAFE.centerX, y, size = 28, weight = "normal", fill = "#ded7f2", anchor = "middle", letterSpacing = 0 }) {
  const spacing = letterSpacing ? ` letter-spacing="${letterSpacing}"` : "";
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="${SVG_FONT_FAMILY}" text-anchor="${anchor}"${spacing}>${escapeXml(content)}</text>`;
}

/**
 * Marca no topo do card.
 *
 * Fica dentro da zona segura de propósito: é o que sobra identificando o site
 * quando a rede recorta só o quadrado central.
 */
export function svgBrandRow(y = 52) {
  return svgText({ content: "INDIES BRASIL", y, size: 20, weight: "bold", fill: "url(#brand)", letterSpacing: 6 });
}

/**
 * Escolhe o tamanho do `@username` para ele não estourar a zona segura.
 *
 * Em vez de medir o texto (não dá sem renderizar) o corte é por comprimento,
 * calibrado para o DejaVu Sans, que é mais largo que o Helvetica.
 */
export function usernameFontSize(username) {
  const length = String(username || "").length;
  if (length > 20) return 34;
  if (length > 14) return 42;
  return 52;
}

/**
 * Avatar circular com anel na cor da marca.
 *
 * `x`/`y` são o canto superior esquerdo do círculo (não o centro). Sem
 * `avatarUrl` desenha um disco com a inicial — um preview com inicial é melhor
 * do que um preview sem imagem.
 *
 * O `clipPath` é emitido aqui dentro, com id derivado das coordenadas: antes
 * ele vivia fixo no `svgHeader` (cx=70 cy=70 r=60), o que só funcionava para
 * uma posição/tamanho — mudar `size` ou `x`/`y` cortava o avatar errado.
 */
export function svgAvatar(avatarUrl, username, { x, y, size = 190, ring = 6 } = {}) {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;
  const clipId = `avatarClip${x}-${y}-${size}`;
  const initial = String(username || "i")
    .charAt(0)
    .toUpperCase();

  return [
    `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${radius}"/></clipPath>`,
    avatarUrl
      ? `<image href="${escapeXml(avatarUrl)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#brand)"/>` +
        svgText({ content: initial, x: cx, y: cy + size * 0.16, size: size * 0.42, weight: "bold", fill: "#ffffff" }),
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="url(#brand)" stroke-width="${ring}"/>`,
  ].join("");
}

/** Rodapé: URL do site e fim do documento (fecha o recorte do `svgHeader`). */
export function svgFooter({ siteUrl = "jogos.social.br" } = {}) {
  return [svgText({ content: siteUrl, y: OG_HEIGHT - 26, size: 20, fill: "#a99cd0" }), "</g>", "</svg>"].join("");
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
