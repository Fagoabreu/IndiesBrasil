/**
 * OG Image API para o preview de links de perfil (WhatsApp, Discord, etc.).
 *
 * Mesma estratégia da rota de post (`pages/api/og/post/[id].js`):
 *
 * - Usuário COM foto: redireciona (302) para a imagem real.
 *   Isso não é só "melhor preview": WhatsApp **não renderiza SVG** em
 *   `og:image`, então um card SVG resultaria em preview sem imagem nenhuma —
 *   exatamente o problema que esta rota veio corrigir. Redirecionar para a foto
 *   (PNG/JPG do Cloudinary) é o que faz o preview aparecer no WhatsApp.
 * - Usuário SEM foto: gera um SVG estilizado com inicial, @username, resumo e
 *   QR code do perfil — que funciona nas plataformas que aceitam SVG.
 *
 * Cache: 24h para foto, 1h para SVG.
 * Acesso: público (sem autenticação — o crawler não tem sessão).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { SITE_URL } from "@/lib/seo";
import { escapeXml, resolveInternalOrigin, setSvgHeaders, svgAvatar, svgFooter, svgHeader, wrapText, OG_WIDTH } from "@/lib/og-image";

export default async function handler(req, res) {
  const { username } = req.query;

  if (!username || Array.isArray(username)) {
    return res.status(400).end();
  }

  try {
    // A rota interna do app resolve visibilidade e filtragem de campos; é a
    // mesma fonte que a página usa, então o card nunca mostra dado que a
    // página esconderia.
    const origin = resolveInternalOrigin(req);
    const apiRes = await fetch(`${origin}/api/v1/users/${encodeURIComponent(username)}/profile`);

    if (!apiRes.ok) {
      return res.status(404).end();
    }

    const profile = await apiRes.json();
    const photoUrl = profile.user?.background_image || profile.user?.avatar_image;

    if (isSafeRedirectTarget(photoUrl)) {
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.statusCode = 302;
      res.setHeader("Location", photoUrl);
      return res.end();
    }

    setSvgHeaders(res);
    return res.status(200).send(renderProfileSvg(profile));
  } catch {
    return res.status(500).end();
  }
}

/**
 * Só redireciona para HTTPS em hosts conhecidos. Os campos vêm de
 * `uploaded_images.secure_url` (Cloudinary, gerado no servidor), mas validar
 * antes do `Location` evita que uma origem futura transforme esta rota em
 * open redirect.
 */
function isSafeRedirectTarget(value) {
  if (typeof value !== "string" || value.length === 0) return false;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  return host === "res.cloudinary.com" || host.endsWith(".cloudinary.com");
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

function renderProfileSvg(profile) {
  const user = profile.user ?? {};
  const username = String(user.username ?? "indiesbrasil");
  const displayName = `@${username}`;
  const avatar = String(user.avatar_image ?? "");
  const profileUrl = `${SITE_URL}/perfil/${encodeURIComponent(username)}`;

  // Resumo costuma ser a melhor linha curta; a bio entra como segunda linha.
  const summary = user.resumo || user.bio || "Perfil na comunidade Indies Brasil.";
  const lines = wrapText(summary, 62, 2);

  // QR de 200px no canto inferior direito, alinhado ao bloco de marca.
  const qrSize = 200;
  const qrX = OG_WIDTH - qrSize - 80;
  const qrY = 330;
  const qrSvg = renderQrSvg(profileUrl, qrSize);

  return [
    svgHeader(),
    svgAvatar(avatar, username),

    // Nome/handle
    `<text x="240" y="140" fill="white" font-size="44" font-weight="bold" font-family="sans-serif">${escapeXml(displayName)}</text>`,
    '<text x="240" y="176" fill="#8b8ba7" font-size="22" font-family="sans-serif">Perfil no Indies Brasil</text>',

    // Resumo (até 2 linhas)
    ...lines.map(
      (line, index) => `<text x="80" y="${270 + index * 44}" fill="#c8c8dc" font-size="30" font-family="sans-serif">${escapeXml(line)}</text>`,
    ),

    // QR code do perfil
    qrSvg ? `<g transform="translate(${qrX}, ${qrY})">${qrSvg}</g>` : "",

    // Rótulo do QR, só quando ele existe
    qrSvg
      ? `<text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 32}" text-anchor="middle" fill="#8b8ba7" font-size="20" font-family="sans-serif">Aponte a câmera</text>`
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
        `<text x="${x}" y="${y}" fill="white" font-size="30" font-weight="bold" font-family="sans-serif">${escapeXml(String(value))}</text>` +
        `<text x="${x}" y="${y + 26}" fill="#666688" font-size="19" font-family="sans-serif">${escapeXml(label)}</text>`
      );
    })
    .join("");
}
