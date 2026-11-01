import { FILTER_NONE, parseAiLevelFilter, parseContentRatingFilter } from "@/lib/productFilters";

/**
 * Filtros de classificação das listagens.
 *
 * O caso que mais importa é o **400**: devolver a lista inteira para um valor
 * desconhecido faria `?ai_level=sete` parecer aplicado — a pessoa acharia que
 * filtrou e veria o catálogo todo. E `"0"` precisa continuar sendo um valor
 * legítimo, porque "sem uso de IA" é uma declaração, não a ausência dela.
 */
describe("lib/productFilters.js", () => {
  test("parâmetro ausente ou vazio não filtra", () => {
    expect(parseContentRatingFilter(undefined)).toBe("");
    expect(parseContentRatingFilter("")).toBe("");
    expect(parseAiLevelFilter(undefined)).toBe("");
    expect(parseAiLevelFilter("   ")).toBe("");
  });

  test("classificação indicativa aceita as faixas do ClassInd", () => {
    for (const rating of ["L", "6", "10", "12", "14", "16", "18"]) {
      expect(parseContentRatingFilter(rating)).toBe(rating);
    }
  });

  test("classificação indicativa aceita none e recusa o resto", () => {
    expect(parseContentRatingFilter(FILTER_NONE)).toBe(FILTER_NONE);
    expect(() => parseContentRatingFilter("livre")).toThrow();
    expect(() => parseContentRatingFilter("19")).toThrow();
  });

  test("nível de IA aceita 0 a 5", () => {
    for (let level = 0; level <= 5; level += 1) {
      expect(parseAiLevelFilter(String(level))).toBe(String(level));
      expect(parseAiLevelFilter(level)).toBe(String(level));
    }
  });

  test("nível de IA aceita none e recusa fora da faixa", () => {
    expect(parseAiLevelFilter(FILTER_NONE)).toBe(FILTER_NONE);
    expect(() => parseAiLevelFilter("6")).toThrow();
    expect(() => parseAiLevelFilter("-1")).toThrow();
    expect(() => parseAiLevelFilter("2.5")).toThrow();
    expect(() => parseAiLevelFilter("alto")).toThrow();
  });

  test("parâmetro repetido é recusado em vez de escolher um valor", () => {
    expect(() => parseAiLevelFilter(["1", "2"])).toThrow();
    expect(() => parseContentRatingFilter(["12", "16"])).toThrow();
  });
});
