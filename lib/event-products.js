/**
 * Produtos que um evento de estúdio pode destacar.
 *
 * Registro único: o formulário monta o `<select>`, o model valida que o produto
 * pertence ao estúdio e o card/página do evento montam o link de volta. Quatro
 * cópias da mesma tabela divergiriam na primeira vez que alguém acrescentasse um
 * tipo.
 *
 * `table` e `column` são usados **só** no model, a partir deste mapa fechado —
 * nunca de entrada do usuário. Interpolar o tipo escolhido pelo cliente no SQL
 * deixaria o visitante decidir qual tabela é lida.
 */
export const EVENT_PRODUCT_TYPES = [
  { type: "game", label: "Jogo", table: "games", column: "game_id", routeSegment: "jogos" },
  { type: "boardgame", label: "Jogo de mesa", table: "boardgames", column: "boardgame_id", routeSegment: "jogos-de-mesa" },
  { type: "book", label: "Livro ou quadrinho", table: "books", column: "book_id", routeSegment: "quadrinhos" },
  { type: "asset", label: "Asset", table: "assets", column: "asset_id", routeSegment: "assets" },
];

const BY_TYPE = new Map(EVENT_PRODUCT_TYPES.map((item) => [item.type, item]));

/** Entrada do mapa, ou `null` quando o tipo não é vinculável. */
export function getEventProductType(type) {
  return BY_TYPE.get(type) ?? null;
}

/** Endereço público do produto, ou `null` sem slug. */
export function eventProductPath(type, slug) {
  const entry = getEventProductType(type);
  if (!entry || !slug) return null;
  return `/${entry.routeSegment}/${slug}`;
}

/** Nome curto para o card: `"Jogo · Nome"`. */
export function eventProductLabel(type, name) {
  const entry = getEventProductType(type);
  if (!entry || !name) return null;
  return `${entry.label} · ${name}`;
}
