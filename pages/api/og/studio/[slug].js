/**
 * OG Image API para o preview de links de estúdio (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com o mesmo fundo dos cards do site (ver
 * `svgCardHeader` em `lib/og-image.js`): superfície clara, faixa com o banner do
 * estúdio no topo e o logo sobreposto a ela — o desenho do `studioCard`.
 *
 * Decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Card, em vez do logo cru.** Antes o `og:image` da página do estúdio era o
 *    próprio logo (512x512): o preview virava um quadrado solto, sem nome nem
 *    contexto, e uma imagem quadrada é cortada ou letterboxed na maioria das
 *    redes.
 * 3. **Sem HTTP interno.** A consulta é direta ao banco: em produção o app vive
 *    só na rede Docker `private` (ver `deploy/compose.yaml`), então alcançar
 *    `https://jogos.social.br` de dentro do container depende de hairpin NAT —
 *    que falha (ver `lib/internal-url.js`).
 *
 * Acesso: público (o crawler não tem sessão). O `findBySlug` já aplica a
 * moderação — estúdio bloqueado responde 404, como na página.
 */

import organization from "@/models/organization";
import { CARD, fetchAsDataUri, renderPng, setPngHeaders, svgCardBadge, svgCardFooter, svgCardHeader, svgText, wrapText } from "@/lib/og-image";

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || Array.isArray(slug)) {
    return res.status(400).end();
  }

  try {
    const studio = await organization.findBySlug(slug);
    const png = await renderPng(await renderStudioSvg(studio));

    setPngHeaders(res, { maxAge: 3600 });
    return res.status(200).send(png);
  } catch (error) {
    // `findBySlug` lança `NotFoundError` para estúdio inexistente ou bloqueado.
    // Retornar 404 só nesse caso (e logar o resto) importa: quando qualquer
    // falha virava 404 mudo, o preview quebrado não deixava rastro nenhum.
    if (error?.statusCode === 404) {
      return res.status(404).end();
    }

    console.error("[og/studio] falha ao gerar o card:", error);
    return res.status(500).end();
  }
}

/** Faixa de "N seguidores", como o `.cardMeta` do card de estúdio. */
function followersLabel(followers) {
  const count = Number(followers);
  if (!Number.isFinite(count) || count <= 0) return null;
  return `${count} ${count === 1 ? "seguidor" : "seguidores"}`;
}

/**
 * Medidas do card.
 *
 * A faixa é mais alta que a do card de perfil e o nome é maior: este card tem
 * menos elementos abaixo do crachá (nome, pitch e seguidores), então precisa de
 * mais peso na faixa para o card não ficar com o rodapé sobrando.
 */
const LAYOUT = { banner: 196, badge: 188, badgeOverlap: 78, nameY: 400, pitchY: 452, pitchLine: 38, followersY: 548 };

/**
 * Card do estúdio, com o fundo dos cards do site.
 *
 * A faixa do topo traz o banner do estúdio (ou o gradiente da marca, quando não
 * há banner) e o logo sobe sobre ela — o mesmo desenho do `studioCard`.
 */
async function renderStudioSvg(studio) {
  const name = String(studio.name || "Estúdio");
  const pitch = String(studio.pitch || "").trim();

  // O rasterizador não busca recursos remotos, então banner e logo viram data
  // URI. Falha silenciosa: cai no gradiente da marca e na superfície do crachá.
  const [banner, logo] = await Promise.all([fetchAsDataUri(studio.banner_url), fetchAsDataUri(studio.logo_url)]);

  const lines = pitch ? wrapText(pitch, 52, 2) : [];
  const followers = followersLabel(studio.follower_count);

  return [
    svgCardHeader({ bannerDataUri: banner, bannerHeight: LAYOUT.banner }),
    // `rounded`: o logo do estúdio é uma marca gráfica (quadrada no site).
    svgCardBadge({
      dataUri: logo,
      size: LAYOUT.badge,
      top: LAYOUT.banner - LAYOUT.badgeOverlap,
      shape: "rounded",
      radius: 28,
    }),

    svgText({ content: name, y: LAYOUT.nameY, size: 52, weight: "bold", fill: CARD.text }),

    ...lines.map((line, index) => svgText({ content: line, y: LAYOUT.pitchY + index * LAYOUT.pitchLine, size: 29, fill: CARD.textMuted })),

    followers ? svgText({ content: followers, y: LAYOUT.followersY, size: 25, fill: CARD.textMuted }) : "",

    svgCardFooter(),
  ].join("");
}
