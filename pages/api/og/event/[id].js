/**
 * OG Image API para o preview de links de evento (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com o mesmo fundo dos cards do site (ver
 * `svgCardHeader` em `lib/og-image.js`): superfície clara, faixa com o banner do
 * evento no topo e, abaixo, o selo do tipo, o título e os dados de quando/onde.
 *
 * Decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Sem HTTP interno.** A consulta é direta ao banco: em produção o app vive
 *    só na rede Docker `private` (ver `deploy/compose.yaml`), então alcançar
 *    `https://jogos.social.br` de dentro do container depende de hairpin NAT —
 *    que falha (ver `lib/internal-url.js`).
 * 3. **Evento privado responde 404.** O card é público por natureza (a rede
 *    social busca sem sessão), então não pode desenhar nome e local de um evento
 *    restrito a convidados. Sem imagem, o link continua funcionando para quem
 *    foi convidado.
 *
 * Acesso: público (o crawler não tem sessão).
 */

import event from "@/models/event";
import { eventTypeAccent, eventTypeLabel } from "@/lib/event-types";
import { isUuid } from "@/lib/uuid";
import { CARD, fetchAsDataUri, renderPng, setPngHeaders, svgCardFooter, svgCardHeader, svgPillRow, svgText, wrapText } from "@/lib/og-image";

/** Cor de "Cancelado" — `--fgColor-danger` do Primer. */
const CANCELLED_ACCENT = "#d1242f";

/**
 * Medidas do card.
 *
 * O banner do evento é bem largo (é a faixa de 866x150 do CSS), então a faixa
 * do card pode ser mais alta que a do perfil sem cortar quase nada.
 *
 * O título pode ocupar duas linhas e os metadados são posicionados **depois**
 * dele, contando as linhas usadas — com altura fixa, um título de duas linhas
 * encostaria nos dados de data e local.
 */
const LAYOUT = {
  banner: 196,
  pillTop: 250,
  titleY: 372,
  titleFont: 48,
  titleLine: 56,
  titleMaxChars: 34,
  titleMaxLines: 2,
  metaGap: 54,
  metaLine: 40,
  metaFont: 27,
  metaMaxChars: 60,
};

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).end();
  }

  // Id não numérico é recusado aqui, não no banco: o Postgres recusa um uuid
  // malformado e o erro chega envelopado pelo `infra/errors.js`, virando 500 em
  // vez de 404.
  if (!isUuid(id)) {
    return res.status(404).end();
  }

  try {
    const found = await event.findById(id, null);

    // Ver a nota 3 do cabeçalho.
    if (found.visibility === "private") {
      return res.status(404).end();
    }

    const png = await renderPng(await renderEventSvg(found));

    setPngHeaders(res, { maxAge: 3600 });
    return res.status(200).send(png);
  } catch (error) {
    // `findById` lança `NotFoundError` para evento inexistente. Retornar 404 só
    // nesse caso (e logar o resto) importa: quando qualquer falha virava 404
    // mudo, o preview quebrado não deixava rastro nenhum.
    if (error?.statusCode === 404) {
      return res.status(404).end();
    }

    console.error("[og/event] falha ao gerar o card:", error);
    return res.status(500).end();
  }
}

/** Data e hora do evento, no formato que a página do evento usa. */
function scheduleLine(ev) {
  const start = new Date(ev.starts_at);
  const long = start.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // `toLocaleDateString` devolve tudo em minúsculas; a linha abre o card, então
  // começa com maiúscula.
  const date = long.charAt(0).toUpperCase() + long.slice(1);

  if (ev.is_all_day) return `${date} · dia inteiro`;

  const time = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** Onde acontece: o endereço quando é presencial, "Online" quando é remoto. */
function placeLine(ev) {
  if (ev.is_online) return "Evento online";

  const where = [ev.location_name, ev.address?.city].filter(Boolean).join(" — ");
  return where || "Local a definir";
}

/**
 * Card do evento: banner, selo do tipo, título e os dados de quando/onde.
 *
 * O organizador entra na última linha, como contexto — o assunto do card é o
 * evento, não quem o criou.
 */
async function renderEventSvg(ev) {
  const title = String(ev.override_title || ev.title || "Evento");
  const schedule = scheduleLine(ev);

  // O rasterizador não busca recursos remotos, então o banner vira data URI.
  // Falha silenciosa: cai no gradiente da marca.
  const banner = await fetchAsDataUri(ev.banner_url);

  const titleLines = wrapText(title, LAYOUT.titleMaxChars, LAYOUT.titleMaxLines);
  const meta = [schedule, placeLine(ev), `por @${ev.organizer_username}`].map((line) => wrapText(line, LAYOUT.metaMaxChars, 1)[0] ?? line);

  // Os metadados começam depois da última linha do título.
  const metaStartY = LAYOUT.titleY + Math.max(titleLines.length - 1, 0) * LAYOUT.titleLine + LAYOUT.metaGap;

  return [
    svgCardHeader({ bannerDataUri: banner, bannerHeight: LAYOUT.banner }),

    svgPillRow({
      items: [
        { text: eventTypeLabel(ev.event_type), accent: eventTypeAccent(ev.event_type) },
        // Mesmo selo do card de evento da agenda: um preview que não avisa que o
        // evento foi cancelado é pior do que não ter preview. Preenchido para não
        // se confundir com o selo do tipo quando os dois são vermelhos.
        ...(ev.status === "cancelled" ? [{ text: "Cancelado", accent: CANCELLED_ACCENT, variant: "solid" }] : []),
      ],
      x: 80,
      y: LAYOUT.pillTop,
    }),

    ...titleLines.map((line, index) =>
      svgText({
        content: line,
        x: 80,
        y: LAYOUT.titleY + index * LAYOUT.titleLine,
        size: LAYOUT.titleFont,
        weight: "bold",
        fill: CARD.text,
        anchor: "start",
      }),
    ),

    ...meta.map((line, index) =>
      svgText({ content: line, x: 80, y: metaStartY + index * LAYOUT.metaLine, size: LAYOUT.metaFont, fill: CARD.textMuted, anchor: "start" }),
    ),

    svgCardFooter(),
  ].join("");
}
