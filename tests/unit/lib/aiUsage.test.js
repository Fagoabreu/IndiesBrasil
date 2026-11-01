import {
  AI_USAGE_LEVELS,
  AI_USAGE_MAX_LEVEL,
  MAX_AI_NOTES_LENGTH,
  formatAiLevelBadge,
  formatAiLevelLabel,
  formatAiLevelName,
  getAiLevel,
  isAiLevel,
  normalizeAiNotes,
} from "@/lib/ai-usage";

/**
 * Registro dos níveis de uso de IA.
 *
 * O que este teste protege:
 *
 * 1. **A escala é fechada em 0..5 e não muda de ordem.** Selo, filtro, banco
 *    (`CHECK`) e modal mostram o mesmo número; um nível a mais em um lugar só
 *    faria produto classificado em 5 aparecer como "não informado".
 * 2. **`0` e `null` são coisas diferentes.** "Sem uso de IA" é declaração;
 *    `null` é ausência de declaração. Tratar os dois igual anuncia algo que
 *    ninguém afirmou.
 */
describe("lib/ai-usage.js", () => {
  test("os níveis são 0 a 5, em ordem e sem buraco", () => {
    expect(AI_USAGE_LEVELS).toHaveLength(AI_USAGE_MAX_LEVEL + 1);
    expect(AI_USAGE_LEVELS.map((item) => item.level)).toEqual([0, 1, 2, 3, 4, 5]);

    for (const item of AI_USAGE_LEVELS) {
      expect(typeof item.name).toBe("string");
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe("string");
      expect(item.description.length).toBeGreaterThan(0);
      expect(typeof item.tone).toBe("string");
    }
  });

  test("cada nível tem um tom visual distinto", () => {
    const tones = AI_USAGE_LEVELS.map((item) => item.tone);
    expect(new Set(tones).size).toBe(tones.length);
  });

  test("isAiLevel aceita 0..5 e recusa o resto", () => {
    expect(isAiLevel(0)).toBe(true);
    expect(isAiLevel(5)).toBe(true);
    expect(isAiLevel("3")).toBe(true);

    expect(isAiLevel(-1)).toBe(false);
    expect(isAiLevel(6)).toBe(false);
    expect(isAiLevel(2.5)).toBe(false);
    expect(isAiLevel("")).toBe(false);
    expect(isAiLevel(null)).toBe(false);
    expect(isAiLevel(undefined)).toBe(false);
    expect(isAiLevel("tres")).toBe(false);
  });

  test("nível 0 existe e não é confundido com não declarado", () => {
    expect(getAiLevel(0)?.name).toBe("Sem Uso de IA");
    expect(getAiLevel(null)).toBeNull();
    expect(getAiLevel(undefined)).toBeNull();
  });

  test("o selo compacto identifica o nível e o não declarado", () => {
    expect(formatAiLevelBadge(3)).toBe("IA 3");
    expect(formatAiLevelBadge("0")).toBe("IA 0");
    expect(formatAiLevelBadge(null)).toBe("IA N/C");
    expect(formatAiLevelBadge(9)).toBe("IA N/C");
  });

  test("o rótulo de filtro traz número e nome", () => {
    expect(formatAiLevelLabel(2)).toContain("IA Ampliada");
    expect(formatAiLevelLabel(2)).toContain("2");
    expect(formatAiLevelLabel(null)).toBe("Não informado");
  });

  test("o nome do nível tem um texto para o não declarado", () => {
    expect(formatAiLevelName(4)).toBe("IA Dominante");
    expect(formatAiLevelName(null)).toBe("Não informado");
  });

  test("as notas são texto puro, aparadas, e vazias viram null", () => {
    expect(normalizeAiNotes("  feito à mão  ")).toBe("feito à mão");
    expect(normalizeAiNotes("   ")).toBeNull();
    expect(normalizeAiNotes(null)).toBeNull();
    expect(normalizeAiNotes(42)).toBeNull();
    expect(normalizeAiNotes("a".repeat(MAX_AI_NOTES_LENGTH + 50))).toHaveLength(MAX_AI_NOTES_LENGTH);
  });
});
