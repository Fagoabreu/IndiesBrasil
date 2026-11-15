import {
  HIGHLIGHTS_MAX_ITEMS,
  HIGHLIGHTS_PER_TYPE,
  HIGHLIGHT_TYPES,
  HIGHLIGHT_TYPE_LABELS,
  HIGHLIGHT_TYPE_ROUTES,
  shouldGroupHighlights,
} from "lib/highlights";

/**
 * O layout da seção "Destaques" depende deste contrato: a página agrupa uma
 * coluna por tipo **apenas** quando o total fecha em múltiplos de
 * `HIGHLIGHTS_PER_TYPE`. Se a regra e o endpoint divergirem, a home mostra uma
 * coluna com 3 itens e outra com 1 — grid que parece quebrado.
 */
describe("lib/highlights.js", () => {
  test("cada tipo tem rótulo e rota", () => {
    for (const type of HIGHLIGHT_TYPES) {
      expect(HIGHLIGHT_TYPE_LABELS[type]).toBeTruthy();
      expect(HIGHLIGHT_TYPE_ROUTES[type]).toMatch(/^\//);
    }
  });

  test("o total máximo é 3 por tipo × 4 tipos", () => {
    expect(HIGHLIGHTS_PER_TYPE).toBe(3);
    expect(HIGHLIGHTS_MAX_ITEMS).toBe(12);
  });

  test("agrupa quando o total é múltiplo de 3", () => {
    expect(shouldGroupHighlights(3)).toBe(true);
    expect(shouldGroupHighlights(6)).toBe(true);
    expect(shouldGroupHighlights(9)).toBe(true);
    expect(shouldGroupHighlights(12)).toBe(true);
  });

  test("não agrupa com contagem que não fecha por tipo", () => {
    expect(shouldGroupHighlights(1)).toBe(false);
    expect(shouldGroupHighlights(2)).toBe(false);
    expect(shouldGroupHighlights(4)).toBe(false);
    expect(shouldGroupHighlights(11)).toBe(false);
    expect(shouldGroupHighlights(0)).toBe(false);
    expect(shouldGroupHighlights(undefined)).toBe(false);
  });
});
