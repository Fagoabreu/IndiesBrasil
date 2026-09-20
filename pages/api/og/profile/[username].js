/**
 * OG Image API para o preview de links de perfil (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com avatar, @username, resumo, estatísticas e o QR
 * code do perfil.
 *
 * Três decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Card sempre, em vez de redirecionar para a foto.** O redirect dava um
 *    preview pobre (só a imagem de capa) e dependia de a plataforma seguir o
 *    302. O card carrega o que identifica o perfil: avatar, nome e QR.
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
  escapeXml,
  fetchAsDataUri,
  renderPng,
  setPngHeaders,
  svgAvatar,
  svgFooter,
  svgHeader,
  SVG_FONT_FAMILY,
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

async function renderProfileSvg(profile) {
  const user = profile.user ?? {};
  const username = String(user.username ?? "indiesbrasil");
  const displayName = `@${username}`;
  const profileUrl = `${SITE_URL}/perfil/${encodeURIComponent(username)}`;

  // O rasterizador não busca recursos remotos, então o avatar precisa virar
  // data URI. Falha silenciosa: cai no círculo com a inicial.
  const avatar = await fetchAsDataUri(user.avatar_image);

  // Resumo costuma ser a melhor linha curta; a bio entra como segunda linha.
  // 50 chars: com 58 o texto alcançava o QR (que começa em x=920).
  const summary = user.resumo || user.bio || "Perfil na comunidade Indies Brasil.";
  const lines = wrapText(summary, 50, 2);

  // QR de 200px no canto inferior direito, alinhado ao bloco de marca.
  const qrSize = 200;
  const qrX = OG_WIDTH - qrSize - 80;
  const qrY = 330;
  const qrSvg = renderQrSvg(profileUrl, qrSize);

  return [
    svgHeader(),
    svgAvatar(avatar, username),

    // Nome/handle
    `<text x="240" y="140" fill="white" font-size="44" font-weight="bold" font-family="${SVG_FONT_FAMILY}">${escapeXml(displayName)}</text>`,
    `<text x="240" y="176" fill="#8b8ba7" font-size="22" font-family="${SVG_FONT_FAMILY}">Perfil no Indies Brasil</text>`,

    // Resumo (até 2 linhas)
    ...lines.map(
      (line, index) =>
        `<text x="80" y="${270 + index * 44}" fill="#c8c8dc" font-size="30" font-family="${SVG_FONT_FAMILY}">${escapeXml(line)}</text>`,
    ),

    // QR code do perfil
    qrSvg ? `<g transform="translate(${qrX}, ${qrY})">${qrSvg}</g>` : "",

    // Rótulo do QR, só quando ele existe
    qrSvg
      ? `<text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 32}" text-anchor="middle" fill="#8b8ba7" font-size="20" font-family="${SVG_FONT_FAMILY}">Aponte a câmera</text>`
      : "",

    // Números do perfil, quando existirem
    renderStats(user, lines.length),

    svgFooter({ brandX: 80 }),
  ].join("");
}

/** Linha de estatísticas abaixo do resumo. Omitida quando tudo é zero. */
function renderStats(user, summaryLines) {
  const stats = [
    ["seguidores", user.followers_count],
    ["seguindo", user.following_count],
    ["postagens", user.posts_count],
  ].filter(([, value]) => Number(value) > 0);

  if (stats.length === 0) return "";

  // Posiciona abaixo do resumo; a base da marca começa em y=440.
  const y = Math.min(270 + summaryLines * 44 + 40, 400);

  return stats
    .map(([label, value], index) => {
      const x = 80 + index * 190;
      return (
        `<text x="${x}" y="${y}" fill="white" font-size="30" font-weight="bold" font-family="${SVG_FONT_FAMILY}">${escapeXml(String(value))}</text>` +
        `<text x="${x}" y="${y + 26}" fill="#666688" font-size="19" font-family="${SVG_FONT_FAMILY}">${escapeXml(label)}</text>`
      );
    })
    .join("");
}
