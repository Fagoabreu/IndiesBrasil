import {
  HIGHLIGHTS_MAX_ITEMS,
  HIGHLIGHTS_PER_TYPE,
  HIGHLIGHT_TYPES,
  HIGHLIGHT_TYPE_HEADINGS,
  HIGHLIGHT_TYPE_LABELS,
  HIGHLIGHT_TYPE_ROUTES,
  groupHighlightsByType,
} from "lib/highlights";

/**
 * Os destaques da home são lidos em **uma linha por tipo** (jogos, jogos de
 * mesa, livros, assets). Antes eram uma grade em coluna e o tipo existia só
 * como selo sobre a arte: quatro etiquetas para descobrir onde um grupo
 * terminava e o outro começava.
 */
describe("lib/highlights.js", () => {
  test("cada tipo tem rótulo de selo, título de linha e rota", () => {
    for (const type of HIGHLIGHT_TYPES) {
      expect(HIGHLIGHT_TYPE_LABELS[type]).toBeTruthy();
      expect(HIGHLIGHT_TYPE_HEADINGS[type]).toBeTruthy();
      expect(HIGHLIGHT_TYPE_ROUTES[type]).toMatch(/^\//);
    }
  });

  test("o título da linha é plural e em caixa de frase", () => {
    // `HIGHLIGHT_TYPE_LABELS` é singular ("Jogo") e serve ao selo do card.
    // Reusá-lo no título daria "3 Jogo" / "3 Asset".
    expect(HIGHLIGHT_TYPE_HEADINGS.game).toBe("Jogos");
    expect(HIGHLIGHT_TYPE_HEADINGS.asset).toBe("Artes e assets");
    expect(HIGHLIGHT_TYPE_HEADINGS.book).toBe("Livros e quadrinhos");
  });

  test("o total máximo é 3 por tipo × 4 tipos", () => {
    expect(HIGHLIGHTS_PER_TYPE).toBe(3);
    expect(HIGHLIGHTS_MAX_ITEMS).toBe(12);
  });
});

describe("groupHighlightsByType", () => {
  const item = (type, slug) => ({ type, slug, name: slug });

  test("agrupa na ordem de HIGHLIGHT_TYPES, não na ordem que chega", () => {
    const groups = groupHighlightsByType([item("book", "livro-1"), item("game", "jogo-1"), item("asset", "asset-1")]);

    expect(groups.map((group) => group.type)).toEqual(["game", "book", "asset"]);
    expect(groups[0].items).toEqual([item("game", "jogo-1")]);
  });

  test("tipo sem item não gera linha", () => {
    const groups = groupHighlightsByType([item("game", "jogo-1")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe("Jogos");
    expect(groups[0].route).toBe("/jogos");
  });

  test("lista vazia e entrada inválida devolvem nenhuma linha", () => {
    expect(groupHighlightsByType([])).toEqual([]);
    expect(groupHighlightsByType(null)).toEqual([]);
    expect(groupHighlightsByType(undefined)).toEqual([]);
  });

  test("não inventa grupo para tipo desconhecido", () => {
    const groups = groupHighlightsByType([item("curso", "curso-1"), item("game", "jogo-1")]);

    expect(groups.map((group) => group.type)).toEqual(["game"]);
  });
});
