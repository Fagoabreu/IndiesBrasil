/**
 * OG Image API para o preview de links de evento (WhatsApp, Discord, etc.).
 *
 * Renderiza um **card PNG** com o mesmo fundo dos cards do site (ver
 * `svgCardHeader` em `lib/og-image.js`): superfície clara, a capa do evento num
 * bloco à esquerda e, à direita, o selo do tipo, o título e os dados de
 * quando/onde.
 *
 * Decisões que valem explicação:
 *
 * 1. **PNG, não SVG.** O WhatsApp não renderiza SVG em `og:image` — servir SVG
 *    resultava em preview sem imagem nenhuma.
 * 2. **Sem HTTP interno.** A consulta é direta ao banco: em produção o app vive
 *    só na rede Docker `private` (ver `deploy/compose.yaml`), então alcançar
 *    `https://jogos.social.br` de dentro do container depende de hairpin NAT —
 *    que falha (ver `lib/internal-url.js`).
 * 3. **Evento que não é público responde 404.** O card é público por natureza
 *    (a rede social busca sem sessão), então não pode desenhar nome e local de
 *    um evento restrito a convidados ou a membros. Sem imagem, o link continua
 *    funcionando para quem tem acesso.
 * 4. **Capa como bloco, não como faixa.** A capa do evento é 16:9 (preset
 *    `eventBanner`): esticada nos 1200px do card ela teria 675px de altura e não
 *    sobraria espaço para o texto, e cortada numa faixa baixa mostrava só o miolo
 *    do enquadramento do organizador.
 *
 * Acesso: público (o crawler não tem sessão).
 */

import event from "@/models/event";
import { eventTypeAccent, eventTypeLabel } from "@/lib/event-types";
import { EVENT_MONTHS_SHORT, EVENT_WEEKDAYS, eventDateParts } from "@/lib/eventFormat";
import { isUuid } from "@/lib/uuid";
import {
  CARD,
  fetchAsDataUri,
  OG_HEIGHT,
  renderPng,
  setPngHeaders,
  svgCardFooter,
  svgCardHeader,
  svgMediaBlock,
  svgPillRow,
  svgText,
  wrapText,
} from "@/lib/og-image";

/** Cor de "Cancelado" — `--fgColor-danger` do Primer. */
const CANCELLED_ACCENT = "#d1242f";

/** Margem lateral/conteúdo do card, como a do card de post. */
const PAD = 64;

/**
 * Bloco da capa: 16:9, na lateral esquerda.
 *
 * A proporção é a do preset `eventBanner` — a mesma que o formulário fez o
 * organizador enquadrar —, então a imagem aparece inteira em vez de recortada.
 */
const MEDIA = { x: PAD, width: 448, height: 252, gap: 44 };

/** Coluna do texto: começa depois do bloco da capa e termina na margem. */
const TEXT = { x: MEDIA.x + MEDIA.width + MEDIA.gap, maxChars: 39 };

/**
 * Medidas da coluna de texto.
 *
 * O bloco (selos + título + metadados) é medido pelas linhas que o título
 * realmente ocupa e centralizado na vertical: com posições fixas, um título de
 * três linhas encostaria nos dados de data e local, e um de uma linha ficaria
 * boiando no topo.
 */
const LAYOUT = {
  pillHeight: 42,
  pillSize: 22,
  titleGap: 66,
  titleFont: 44,
  titleLine: 54,
  titleMaxChars: 22,
  titleMaxLines: 3,
  metaGap: 52,
  metaFont: 25,
  metaLine: 40,
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
    // `null` = visitante sem sessão. O `findById` só devolve evento público
    // nesse caso, e lança `NotFoundError` para `private` e `members` — a
    // checagem de visibilidade saiu daqui porque passou a morar no model
    // (`visibilityCondition`), junto da regra que a lista usa.
    const found = await event.findById(id, null);

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

/**
 * Data e hora do evento, no fuso de exibição da agenda.
 *
 * Sai de `eventDateParts` (que lê o instante no fuso de Brasília) e não de
 * `toLocaleDateString`: sem `timeZone` a formatação usava o fuso do processo —
 * UTC no servidor — e o card anunciava uma data/hora até 3h à frente da que a
 * página do evento mostra.
 */
function scheduleLine(ev) {
  const { weekday, day, month, year, time } = eventDateParts(ev.starts_at);
  const date = `${EVENT_WEEKDAYS[weekday]}, ${day} de ${EVENT_MONTHS_SHORT[month]} de ${year}`;

  return ev.is_all_day ? `${date} · dia inteiro` : `${date} · ${time}`;
}

/** Onde acontece: o endereço quando é presencial, "Online" quando é remoto. */
function placeLine(ev) {
  if (ev.is_online) return "Evento online";

  const where = [ev.location_name, ev.address?.city].filter(Boolean).join(" — ");
  return where || "Local a definir";
}

/**
 * Card do evento: capa à esquerda, selo do tipo, título e quando/onde à direita.
 *
 * O organizador entra na última linha, como contexto — o assunto do card é o
 * evento, não quem o criou.
 */
async function renderEventSvg(ev) {
  const title = String(ev.override_title || ev.title || "Evento");

  // O rasterizador não busca recursos remotos, então a capa vira data URI.
  // Falha silenciosa: cai no gradiente da marca.
  const banner = await fetchAsDataUri(ev.banner_url);

  const titleLines = wrapText(title, LAYOUT.titleMaxChars, LAYOUT.titleMaxLines);
  const meta = [scheduleLine(ev), placeLine(ev), `por @${ev.organizer_username}`].map((line) => wrapText(line, TEXT.maxChars, 1)[0] ?? line);

  // Centraliza o bloco de texto pela altura que ele de fato ocupa.
  const textHeight = LAYOUT.pillHeight + LAYOUT.titleGap + titleLines.length * LAYOUT.titleLine + LAYOUT.metaGap + meta.length * LAYOUT.metaLine;
  const pillTop = Math.round((OG_HEIGHT - textHeight) / 2);
  const titleY = pillTop + LAYOUT.pillHeight + LAYOUT.titleGap;
  const metaStartY = titleY + (titleLines.length - 1) * LAYOUT.titleLine + LAYOUT.metaGap;

  return [
    // Sem faixa (`bannerHeight: 0`): a capa é o bloco da lateral. A barra de
    // gradiente mantém a identidade que a faixa dava.
    svgCardHeader({ bannerHeight: 0, brandBar: true }),

    svgMediaBlock({
      dataUri: banner,
      x: MEDIA.x,
      y: (OG_HEIGHT - MEDIA.height) / 2,
      width: MEDIA.width,
      height: MEDIA.height,
    }),

    svgPillRow({
      items: [
        { text: eventTypeLabel(ev.event_type), accent: eventTypeAccent(ev.event_type) },
        // Mesmo selo do card de evento da agenda: um preview que não avisa que o
        // evento foi cancelado é pior do que não ter preview. Preenchido para não
        // se confundir com o selo do tipo quando os dois são vermelhos.
        ...(ev.status === "cancelled" ? [{ text: "Cancelado", accent: CANCELLED_ACCENT, variant: "solid" }] : []),
      ],
      x: TEXT.x,
      y: pillTop,
      height: LAYOUT.pillHeight,
      fontSize: LAYOUT.pillSize,
    }),

    ...titleLines.map((line, index) =>
      svgText({
        content: line,
        x: TEXT.x,
        y: titleY + index * LAYOUT.titleLine,
        size: LAYOUT.titleFont,
        weight: "bold",
        fill: CARD.text,
        anchor: "start",
      }),
    ),

    ...meta.map((line, index) =>
      svgText({ content: line, x: TEXT.x, y: metaStartY + index * LAYOUT.metaLine, size: LAYOUT.metaFont, fill: CARD.textMuted, anchor: "start" }),
    ),

    svgCardFooter(),
  ].join("");
}
