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
  OG_SAFE,
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
 * Duas medidas para o mesmo card, conforme o post tenha ou não imagem.
 *
 * Com imagem ela ocupa o miolo e o texto fica com o espaço de baixo; sem
 * imagem o texto sobe e cresce.
 */
const LAYOUT = {
  withPhoto: { authorY: 106, avatarSize: 44, authorFont: 26, textSize: 28, maxChars: 34, maxLines: 3, lineHeight: 36, firstLineY: 478 },
  withoutPhoto: { authorY: 190, avatarSize: 60, authorFont: 30, textSize: 36, maxChars: 26, maxLines: 4, lineHeight: 54, firstLineY: 290 },
};

/**
 * Caixa onde a imagem do post é encaixada, dentro da zona segura.
 *
 * É um **limite**, não uma moldura rígida: a imagem é desenhada na proporção
 * dela, encaixada aqui dentro.
 */
const PHOTO_BOX = { maxWidth: 520, maxHeight: 300, y: 132 };

/**
 * Reduz a imagem para caber na caixa mantendo a proporção.
 *
 * A imagem entra inteira, nunca recortada: as publicações antigas foram enviadas
 * antes do preset `post` (4:3) existir e têm proporções variadas — recortar para
 * uma moldura fixa cortaria o texto que a própria arte traz (o banner do WAR47,
 * por exemplo, é 2:1 e tem o título desenhado na imagem).
 */
function fitBox(width, height) {
  const scale = Math.min(PHOTO_BOX.maxWidth / width, PHOTO_BOX.maxHeight / height);
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
  const x = OG_SAFE.centerX - fitted.width / 2;
  // Centraliza na caixa: artes largas (2:1) ficam mais baixas que a caixa, e o
  // espaço que sobra fica igual em cima e embaixo.
  const y = PHOTO_BOX.y + (PHOTO_BOX.maxHeight - fitted.height) / 2;
  const radius = 16;

  return [
    `<clipPath id="postPhotoClip"><rect x="${x}" y="${y}" width="${fitted.width}" height="${fitted.height}" rx="${radius}"/></clipPath>`,
    `<image href="${escapeXml(dataUri)}" x="${x}" y="${y}" width="${fitted.width}" height="${fitted.height}" preserveAspectRatio="none" clip-path="url(#postPhotoClip)"/>`,
    `<rect x="${x}" y="${y}" width="${fitted.width}" height="${fitted.height}" rx="${radius}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>`,
  ].join("");
}

/**
 * Card do post, montado dentro da zona segura.
 *
 * A publicação é o assunto: o texto dela no centro e a imagem emoldurada. O
 * autor entra como linha de atribuição pequena no topo — antes ele era o avatar
 * grande e o `@handle` em destaque no meio do card, a mesma composição do card
 * de perfil, desenhada por cima da imagem da publicação.
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
    svgAuthorRow({ avatarUrl: avatar, username, y: layout.authorY, avatarSize: layout.avatarSize, fontSize: layout.authorFont }),
    photo ? svgPostPhoto(photo) : "",
    ...lines.map((line, index) =>
      svgText({ content: line, y: layout.firstLineY + index * layout.lineHeight, size: layout.textSize, fill: "#e7e1f8" }),
    ),
    svgFooter(),
  ].join("");
}
