/**
 * OG Image API para o preview de links de post (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com o texto da publicação e — quando o post tem
 * imagem — a imagem dela emoldurada. O autor aparece como uma linha de
 * atribuição pequena no topo.
 *
 * Decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Card sempre, em vez de redirecionar para a foto do post.** O redirect
 *    dependia de a plataforma seguir o 302 e entregava só a imagem, sem
 *    contexto.
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
import { postText } from "@/lib/seo";
import {
  escapeXml,
  fetchAsDataUri,
  fetchImage,
  renderPng,
  setPngHeaders,
  svgAuthorRow,
  svgBrandRow,
  svgFooter,
  svgHeader,
  svgText,
  wrapText,
  OG_PAD,
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
 * Medidas do card, conforme o post tenha ou não imagem anexada.
 *
 * Sem imagem o texto sobe e cresce, ocupando o espaço que a imagem deixaria.
 */
const LAYOUT = {
  withPhoto: { authorY: 108, avatarSize: 54, authorFont: 31, textFont: 31, maxChars: 54, maxLines: 2, lineHeight: 42, firstLineY: 190 },
  withoutPhoto: { authorY: 150, avatarSize: 72, authorFont: 36, textFont: 38, maxChars: 45, maxLines: 5, lineHeight: 56, firstLineY: 258 },
};

/**
 * Faixa onde a imagem do post é encaixada, logo abaixo do texto.
 *
 * A largura é a útil do card inteiro: a imagem é o que a pessoa compartilhou,
 * então é o elemento que mais precisa de espaço. É um **limite**, não uma
 * moldura — a imagem é desenhada na proporção dela, encaixada aqui dentro.
 *
 * A imagem entra inteira, nunca recortada: as publicações antigas foram enviadas
 * antes do preset `post` (4:3) existir e têm proporções variadas — recortar para
 * uma moldura fixa cortaria o texto que a própria arte traz (o banner do WAR47,
 * por exemplo, é 2:1 e tem o título desenhado na imagem).
 */
const PHOTO = { y: 254, maxWidth: OG_WIDTH - 2 * OG_PAD, maxHeight: 326 };

/** Reduz a imagem para caber na faixa mantendo a proporção. */
function fitBox(width, height) {
  const scale = Math.min(PHOTO.maxWidth / width, PHOTO.maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Imagem do post, emoldurada e centralizada.
 *
 * Emoldurada em vez de sangrar pelo card inteiro porque a arte das publicações
 * já costuma trazer texto próprio: cobrindo o card com ela, o nosso texto tinha
 * que ser desenhado por cima, e os dois competiam.
 */
function svgPostPhoto({ dataUri, width, height }) {
  const fitted = fitBox(width, height);
  const x = OG_WIDTH / 2 - fitted.width / 2;
  // Centraliza na faixa: artes largas (2:1) ficam mais baixas que a faixa, e o
  // espaço que sobra fica igual em cima e embaixo.
  const y = PHOTO.y + (PHOTO.maxHeight - fitted.height) / 2;
  const radius = 16;

  return [
    `<clipPath id="postPhotoClip"><rect x="${x}" y="${y}" width="${fitted.width}" height="${fitted.height}" rx="${radius}"/></clipPath>`,
    `<image href="${escapeXml(dataUri)}" x="${x}" y="${y}" width="${fitted.width}" height="${fitted.height}" preserveAspectRatio="none" clip-path="url(#postPhotoClip)"/>`,
    `<rect x="${x}" y="${y}" width="${fitted.width}" height="${fitted.height}" rx="${radius}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>`,
  ].join("");
}

/**
 * Card do post: um post de verdade, não um cartão de citação.
 *
 * A composição segue a anatomia de uma publicação — cabeçalho do autor no topo,
 * o texto dela abaixo e a imagem anexada embaixo, alinhados à esquerda. O
 * avatar grande e centralizado com o `@handle` em destaque (a composição do
 * card de perfil) saiu daqui: era o que fazia a prévia do post parecer a prévia
 * do perfil desenhada por cima da publicação.
 */
async function renderSvg(postData) {
  const username = String(postData.author_username || "indiesbrasil");
  // Mesmo texto que os metadados publicam (`lib/seo.js`), para a imagem e a
  // prévia do link não contarem coisas diferentes.
  const content = postText(postData);

  // O rasterizador não busca recursos remotos, então avatar e imagem viram data
  // URI. Falha silenciosa: o card perde só aquele elemento.
  const [avatar, photo] = await Promise.all([fetchAsDataUri(postData.author_avatar_url), fetchImage(postData.post_img_url)]);

  const layout = photo ? LAYOUT.withPhoto : LAYOUT.withoutPhoto;
  const lines = wrapText(content, layout.maxChars, layout.maxLines);

  return [
    svgHeader(),
    svgBrandRow(),
    svgAuthorRow({
      avatarUrl: avatar,
      username,
      y: layout.authorY,
      avatarSize: layout.avatarSize,
      fontSize: layout.authorFont,
      align: "start",
    }),
    ...lines.map((line, index) =>
      svgText({
        content: line,
        x: OG_PAD,
        y: layout.firstLineY + index * layout.lineHeight,
        size: layout.textFont,
        fill: "#e7e1f8",
        anchor: "start",
      }),
    ),
    photo ? svgPostPhoto(photo) : "",
    svgFooter(),
  ].join("");
}
