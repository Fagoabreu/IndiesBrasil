import { EVENT_PRODUCT_TYPES, eventProductLabel, eventProductPath, getEventProductType } from "@/lib/event-products";

/**
 * Registro dos produtos vinculáveis a um evento.
 *
 * O que importa aqui: o **caminho público** tem de ser o mesmo das listagens
 * (`/jogos`, `/jogos-de-mesa`, `/quadrinhos`, `/assets`) — um `routeSegment`
 * errado faz o link "Ver o jogo" do evento abrir 404 —, e o tipo desconhecido
 * não pode virar SQL. A tabela e a coluna vêm deste mapa fechado, nunca de
 * entrada do usuário.
 */
describe("lib/event-products.js", () => {
  test("cobre os quatro produtos publicáveis", () => {
    expect(EVENT_PRODUCT_TYPES.map((item) => item.type)).toEqual(["game", "boardgame", "book", "asset"]);
  });

  test("cada tipo aponta para a tabela e a coluna certas do evento", () => {
    expect(getEventProductType("game")).toMatchObject({ table: "games", column: "game_id" });
    expect(getEventProductType("boardgame")).toMatchObject({ table: "boardgames", column: "boardgame_id" });
    expect(getEventProductType("book")).toMatchObject({ table: "books", column: "book_id" });
    expect(getEventProductType("asset")).toMatchObject({ table: "assets", column: "asset_id" });
  });

  test("tipo desconhecido devolve null em vez de inventar tabela", () => {
    expect(getEventProductType("filme")).toBeNull();
    expect(getEventProductType("")).toBeNull();
    expect(getEventProductType(undefined)).toBeNull();
  });

  test("o caminho público é o mesmo das listagens", () => {
    expect(eventProductPath("game", "meu-jogo")).toBe("/jogos/meu-jogo");
    expect(eventProductPath("boardgame", "mesa")).toBe("/jogos-de-mesa/mesa");
    expect(eventProductPath("book", "livro")).toBe("/quadrinhos/livro");
    expect(eventProductPath("asset", "pacote")).toBe("/assets/pacote");
  });

  test("sem slug ou sem tipo não há link", () => {
    expect(eventProductPath("game", null)).toBeNull();
    expect(eventProductPath("filme", "x")).toBeNull();
  });

  test("o rótulo do card junta tipo e nome", () => {
    expect(eventProductLabel("game", "Meu Jogo")).toBe("Jogo · Meu Jogo");
    expect(eventProductLabel("book", "Meu Livro")).toBe("Livro ou quadrinho · Meu Livro");
    expect(eventProductLabel("game", null)).toBeNull();
  });
});
