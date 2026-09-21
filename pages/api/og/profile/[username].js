/**
 * OG Image API para o preview de links de perfil (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com o mesmo fundo dos cards do site (ver
 * `svgCardHeader` em `lib/og-image.js`): superfície clara, faixa com a capa do
 * perfil no topo e o avatar sobreposto a ela.
 *
 * Decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Card sempre, em vez de redirecionar para a foto.** O redirect dava um
 *    preview pobre (só a imagem de capa) e dependia de a plataforma seguir o
 *    302.
 * 3. **Sem HTTP interno.** Antes esta rota (e a de post) chamavam a própria API
 *    via `fetch` para o domínio público. Em produção o app vive só na rede
 *    Docker `private` (ver `deploy/compose.yaml`), então alcançar
 *    `https://jogos.social.br` de dentro do container depende de hairpin NAT —
 *    que falha, e a rota respondia 500. A consulta agora é direta ao banco.
 *
 * Acesso: público (o crawler não tem sessão), com a mesma filtragem de campos
 * que a API aplica.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import profile from "@/models/profile";
import authorization from "@/models/authorization";
import { SITE_URL } from "@/lib/seo";
import {
  CARD,
  CARD_BANNER,
  fetchAsDataUri,
  renderPng,
  setPngHeaders,
  svgCardBadge,
  svgCardFooter,
  svgCardHeader,
  svgText,
  usernameFontSize,
  wrapText,
  OG_WIDTH,
} from "@/lib/og-image";

export default async function handler(req, res) {
  const { username } = req.query;

  if (!username || Array.isArray(username)) {
    return res.status(400).end();
  }

  try {
    const reader = authorization.anonymousReader;
    const found = await profile.findByUsername(username, reader);
    const secured = authorization.filterOutput(reader, "read:profile", found);

    const png = await renderPng(await renderProfileSvg(secured));

    setPngHeaders(res, { maxAge: 3600 });
    return res.status(200).send(png);
  } catch (error) {
    // `findByUsername` lança `NotFoundError` para perfil inexistente. Retornar
    // 404 só nesse caso (e logar o resto) importa: quando qualquer falha virava
    // 404 mudo, o preview quebrado em produção não deixava rastro nenhum.
    if (error?.statusCode === 404) {
      return res.status(404).end();
    }

    console.error("[og/profile] falha ao gerar o card:", error);
    return res.status(500).end();
  }
}

/** QR code do perfil como SVG inline, pronto para embutir no card. */
function renderQrSvg(profileUrl, size) {
  try {
    // `createElement` em vez de JSX: as rotas de API deste projeto não usam JSX,
    // e aqui só precisamos montar um elemento — a lib já gera o SVG.
    // Fundo branco e nível M: dentro de um card escuro, o QR precisa de
    // contraste garantido para ser legível.
    return renderToStaticMarkup(
      createElement(QRCodeSVG, {
        value: profileUrl,
        size,
        bgColor: "#ffffff",
        fgColor: "#0f0c29",
        level: "M",
        marginSize: 2,
        title: `QR code do perfil ${profileUrl}`,
      }),
    );
  } catch {
    // Se a lib falhar, o card segue sem QR — melhor que perder o preview todo.
    return null;
  }
}

/**
 * Card do perfil, com o fundo dos cards do site.
 *
 * A faixa do topo traz a capa do perfil (ou o gradiente da marca, quando o
 * usuário não enviou capa) e o avatar sobe sobre ela — o mesmo desenho do
 * `MemberCard` e do cabeçalho da página de perfil.
 */
async function renderProfileSvg(profile) {
  const user = profile.user ?? {};
  const username = String(user.username ?? "indiesbrasil");
  const profileUrl = `${SITE_URL}/perfil/${encodeURIComponent(username)}`;

  // O rasterizador não busca recursos remotos, então capa e avatar viram data
  // URI. Falha silenciosa: cai no gradiente da marca e no círculo da inicial.
  const [banner, avatar] = await Promise.all([fetchAsDataUri(user.background_image), fetchAsDataUri(user.avatar_image)]);

  // Resumo costuma ser a melhor linha curta; a bio entra como alternativa.
  const summary = user.resumo || user.bio || "Perfil na comunidade Indies Brasil.";
  const lines = wrapText(summary, 54, 2);

  const badgeSize = 164;
  // Margem negativa do avatar sobre a faixa, como no `.avatarWrapper` do CSS.
  const badgeTop = CARD_BANNER - 64;
  const qrSize = 132;
  const qrSvg = renderQrSvg(profileUrl, qrSize);

  return [
    svgCardHeader({ bannerDataUri: banner }),
    svgCardBadge({ dataUri: avatar, label: username, size: badgeSize, top: badgeTop }),

    svgText({ content: `@${username}`, y: 330, size: usernameFontSize(username), weight: "bold", fill: CARD.text }),

    // Resumo (até 2 linhas)
    ...lines.map((line, index) => svgText({ content: line, y: 368 + index * 30, size: 26, fill: CARD.textMuted })),

    // QR code do perfil
    qrSvg ? `<g transform="translate(${OG_WIDTH / 2 - qrSize / 2}, 428)">${qrSvg}</g>` : "",

    svgCardFooter(),
  ].join("");
}
