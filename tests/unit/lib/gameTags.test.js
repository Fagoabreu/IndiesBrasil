import gameTags, { MAX_GAME_TAGS, MAX_TAG_LENGTH, MIN_TAG_LENGTH, normalizeTagName, parseTagInput } from "@/lib/gameTags";

describe("lib/gameTags", () => {
  describe("normalizeTagName", () => {
    test("minúsculo, apara e colapsa espaços", () => {
      expect(normalizeTagName("  2D   Topdown ")).toBe("2d topdown");
    });

    test("o # é prefixo de exibição e não faz parte do valor gravado", () => {
      expect(normalizeTagName("#Emocional")).toBe("emocional");
      expect(normalizeTagName("###multiplayer")).toBe("multiplayer");
    });

    test("acento é preservado", () => {
      // `tags.name` é único por valor exato e já tem termos acentuados de posts.
      // Normalizar acento aqui faria a tag do jogo não casar com a do post.
      expect(normalizeTagName("Emocional Ação")).toBe("emocional ação");
    });

    test("vazio vira null", () => {
      expect(normalizeTagName("")).toBeNull();
      expect(normalizeTagName("   ")).toBeNull();
      expect(normalizeTagName("#")).toBeNull();
    });
  });

  describe("parseTagInput", () => {
    test("separa por vírgula e devolve na ordem digitada", () => {
      expect(parseTagInput("2d topdown, Emocional, multiplayer")).toEqual(["2d topdown", "emocional", "multiplayer"]);
    });

    test("aceita array (o formulário já envia lista)", () => {
      expect(parseTagInput(["Puzzle", "#Cozy"])).toEqual(["puzzle", "cozy"]);
    });

    test("deduplica depois de normalizar", () => {
      expect(parseTagInput("Cozy, cozy, #COZY")).toEqual(["cozy"]);
    });

    test("descarta o que é curto demais sem abortar o resto", () => {
      // Tag de 2 letras é ignorada em silêncio: recusar o formulário inteiro por
      // causa de uma tag acessória seria hostil.
      expect(parseTagInput("ok, puzzle")).toEqual(["puzzle"]);
    });

    test("descarta o que passa do limite de 50 caracteres", () => {
      expect(parseTagInput(`${"a".repeat(MAX_TAG_LENGTH + 1)}, puzzle`)).toEqual(["puzzle"]);
      expect(parseTagInput(`${"a".repeat(MAX_TAG_LENGTH)}`)).toHaveLength(1);
    });

    test("entrada vazia devolve lista vazia", () => {
      expect(parseTagInput("")).toEqual([]);
      expect(parseTagInput(null)).toEqual([]);
      expect(parseTagInput(", , ,")).toEqual([]);
    });
  });

  test("os limites são os de tags.name", () => {
    expect(MIN_TAG_LENGTH).toBe(3);
    expect(MAX_TAG_LENGTH).toBe(50);
    expect(MAX_GAME_TAGS).toBe(8);
  });

  test("o default export expõe as funções nomeadas", () => {
    expect(gameTags.normalizeTagName).toBe(normalizeTagName);
    expect(gameTags.parseTagInput).toBe(parseTagInput);
  });
});
