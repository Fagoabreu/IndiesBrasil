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
import {
  fetchAsDataUri,
  renderPng,
  setPngHeaders,
  svgAvatar,
  svgBrandRow,
  svgFooter,
  svgHeader,
  svgText,
  usernameFontSize,
  wrapText,
  OG_HEIGHT,
  OG_SAFE,
  OG_WIDTH,
} from "@/lib/og-image";

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).end();
  }

  // Id não numérico é recusado aqui, não no banco: o erro do Postgres chega
  // envelopado pelo `infra/errors.js` e viraria um 500 em vez de 404.
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(404).end();
  }

  try {
    const reader = authorization.anonymousReader;
    const found = await post.getPostById(null, postId);
    const secured = authorization.filterOutput(reader, "read:post", found);

    const png = await renderPng(await renderSvg(secured));

    setPngHeaders(res, { maxAge: 3600 });
    return res.status(200).send(png);
  } catch (error) {
    // `getPostById` lança `NotFoundError` para post inexistente. Retornar 404 só
    // nesse caso (e logar o resto) importa: quando qualquer falha virava 404
    // mudo, o preview quebrado em produção não deixava rastro nenhum.
    if (error?.statusCode === 404) {
      return res.status(404).end();
    }

    console.error("[og/post] falha ao gerar o card:", error);
    return res.status(500).end();
  }
}

// ── SVG renderer ──────────────────────────────────────────────

/**
 * Card do post, montado dentro da zona segura.
 *
 * Quando o post tem imagem ela vira o fundo inteiro (com um véu escuro por
 * cima): é o elemento que mais chama atenção no feed, e como o texto fica
 * centrado ele sobrevive ao recorte quadrado do WhatsApp.
 */
async function renderSvg(postData) {
  const username = String(postData.author_username || "indiesbrasil");
  const content = String(postData.content || "Confira este post no Indies Brasil!");

  // O rasterizador não busca recursos remotos, então avatar e imagem viram
  // data URI. Falha silenciosa: o card perde só aquele elemento.
  const [avatar, photo] = await Promise.all([fetchAsDataUri(postData.author_avatar_url), fetchAsDataUri(postData.post_img_url)]);

  // 34 chars cabem na largura útil com a fonte do card.
  const lines = wrapText(content, 34, 3);
  const avatarSize = 130;

  return [
    svgHeader(),

    // Imagem do post sangrando até a borda, coberta por um véu para o texto
    // continuar legível em cima dela.
    photo
      ? `<image href="${photo}" x="0" y="0" width="${OG_WIDTH}" height="${OG_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>` +
        `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="rgba(14,9,32,0.72)"/>`
      : "",

    svgBrandRow(),
    svgAvatar(avatar, username, { x: OG_SAFE.centerX - avatarSize / 2, y: 74, size: avatarSize }),

    svgText({ content: `@${username}`, y: 262, size: usernameFontSize(username), weight: "bold", fill: "#ffffff" }),

    // Trecho do conteúdo (até 3 linhas)
    ...lines.map((line, index) => svgText({ content: line, y: 322 + index * 38, size: 30, fill: "#e2dcf6" })),

    svgFooter(),
  ].join("");
}
