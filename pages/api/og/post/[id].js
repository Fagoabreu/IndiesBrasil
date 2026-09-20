/**
 * OG Image API para o preview de links de post (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com avatar do autor, @username, trecho do
 * conteúdo e — quando o post tem imagem — uma miniatura ao lado.
 *
 * Três decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Card sempre, em vez de redirecionar para a foto do post.** O redirect
 *    dependia de a plataforma seguir o 302 e entregava só a imagem, sem autor
 *    nem contexto. A miniatura embutida resolve os dois.
 * 3. **Sem HTTP interno.** Antes esta rota (e a de perfil) chamavam a própria
 *    API via `fetch` para o domínio público. Em produção o app vive só na rede
 *    Docker `private` (ver `deploy/compose.yaml`), então alcançar
 *    `https://jogos.social.br` de dentro do container depende de hairpin NAT —
 *    que falha, e a rota respondia 500 (era o caso dos previews quebrados). A
 *    consulta agora é direta ao banco.
 *
 * A moldura do card, os gradientes e o avatar vêm de `lib/og-image.js` — os
 * mesmos usados pelo card de perfil (`pages/api/og/profile/[username].js`).
 *
 * Cache: 1h. Acesso: público (o crawler não tem sessão), com a mesma filtragem
 * de campos que a API aplica.
 */

import post from "@/models/post";
import authorization from "@/models/authorization";
import { escapeXml, fetchAsDataUri, renderPng, setPngHeaders, svgAvatar, svgFooter, svgHeader, SVG_FONT_FAMILY, wrapText } from "@/lib/og-image";

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).end();
  }

  try {
    const reader = authorization.anonymousReader;
    const found = await post.getPostById(null, id);
    const secured = authorization.filterOutput(reader, "read:post", found);

    const png = await renderPng(await renderSvg(secured));

    setPngHeaders(res, { maxAge: 3600 });
    return res.status(200).send(png);
  } catch (error) {
    // `getPostById` lança `NotFoundError` para post inexistente (e o próprio
    // banco recusa id não numérico). Retornar 404 só nesse caso (e logar o
    // resto) importa: quando qualquer falha virava 404 mudo, o preview quebrado
    // em produção não deixava rastro nenhum.
    if (error?.statusCode === 404 || error?.code === "22P02") {
      return res.status(404).end();
    }

    console.error("[og/post] falha ao gerar o card:", error);
    return res.status(500).end();
  }
}

// ── SVG renderer ──────────────────────────────────────────────

/** Área da miniatura do post, à direita do texto. */
const THUMB = { x: 760, y: 110, width: 360, height: 300, radius: 18 };

async function renderSvg(postData) {
  const username = String(postData.author_username || "indiesbrasil");
  const content = String(postData.content || "Confira este post no Indies Brasil!");

  // O rasterizador não busca recursos remotos, então avatar e miniatura viram
  // data URI. Falha silenciosa: o card perde só aquele elemento.
  const [avatar, thumb] = await Promise.all([fetchAsDataUri(postData.author_avatar_url), fetchAsDataUri(postData.post_img_url)]);

  // 40 chars: o texto ocupa ~600px e a miniatura começa em x=760.
  const lines = wrapText(content, 40, 3);

  return [
    svgHeader(
      thumb
        ? `<clipPath id="thumbClip"><rect x="${THUMB.x}" y="${THUMB.y}" width="${THUMB.width}" height="${THUMB.height}" rx="${THUMB.radius}"/></clipPath>`
        : "",
    ),
    svgAvatar(avatar, username),

    `<text x="240" y="130" fill="white" font-size="38" font-weight="bold" font-family="${SVG_FONT_FAMILY}">@${escapeXml(username)}</text>`,

    // Trecho do conteúdo (até 3 linhas)
    ...lines.map(
      (line, index) =>
        `<text x="80" y="${280 + index * 46}" fill="#c8c8dc" font-size="30" font-family="${SVG_FONT_FAMILY}">${escapeXml(line)}</text>`,
    ),

    // Miniatura, em corte centralizado para preencher o retângulo
    thumb
      ? `<image href="${escapeXml(thumb)}" x="${THUMB.x}" y="${THUMB.y}" width="${THUMB.width}" height="${THUMB.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumbClip)"/>` +
        `<rect x="${THUMB.x}" y="${THUMB.y}" width="${THUMB.width}" height="${THUMB.height}" rx="${THUMB.radius}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>`
      : "",

    '<line x1="80" y1="400" x2="700" y2="400" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>',

    svgFooter({ brandX: 80 }),
  ].join("");
}
