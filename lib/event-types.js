/**
 * Vocabulário dos tipos de evento: valor no banco, rótulo e cor do selo.
 *
 * Fica em `lib/` porque quatro lugares precisam do mesmo vocabulário: as opções
 * do formulário (`components/Agenda/eventFormOptions.js`), o selo exibido na
 * agenda, o selo na página do evento e o card de Open Graph
 * (`pages/api/og/event/[id].js`). O rótulo já estava copiado nas telas e as
 * cópias tinham divergido — a agenda mostrava "Lançamento" enquanto o detalhe
 * mostrava "Lançamento de Jogo" para o mesmo evento.
 */

/**
 * `accent` é a cor do selo do tipo.
 *
 * Mora aqui, junto do tipo, em vez de só no CSS, porque o card de OG também
 * precisa dela — e SVG rasterizado não enxerga CSS variable. Os mesmos valores
 * estão em `.typeBadge.<tipo>` de `pages/agenda/index.module.css` e de
 * `pages/agenda/[id]/index.module.css`; ao mudar um, mude o outro.
 */
export const EVENT_TYPES = [
  { value: "general", label: "Geral", accent: "#6366f1" },
  { value: "game_launch", label: "Lançamento de Jogo", accent: "#f59e0b" },
  { value: "game_jam", label: "Game Jam", accent: "#10b981" },
  { value: "stream_marathon", label: "Maratona de Stream", accent: "#ef4444" },
  // `--brand-primary` e `--brand-secondary` (css/styles.css).
  { value: "meeting", label: "Reunião", accent: "#8b5cf6" },
  { value: "studio", label: "Evento de Estúdio", accent: "#e879b8" },
];

const BY_VALUE = new Map(EVENT_TYPES.map((type) => [type.value, type]));

/** Rótulo do tipo. Tipo desconhecido volta cru, em vez de sumir da tela. */
export function eventTypeLabel(value) {
  return BY_VALUE.get(value)?.label ?? String(value ?? "");
}

/** Cor do selo do tipo. Tipo desconhecido cai no neutro (`--fgColor-muted`). */
export function eventTypeAccent(value) {
  return BY_VALUE.get(value)?.accent ?? "#59636e";
}
