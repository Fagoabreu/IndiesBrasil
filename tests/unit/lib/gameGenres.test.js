import gameGenres, {
  MAX_GAME_GENRES,
  NO_GENRE,
  genreKey,
  genrePath,
  normalizeGenreName,
  normalizeSelection,
  splitGenreNames,
} from "@/lib/gameGenres";

/** Catálogo mínimo com a mesma forma do banco (`name` + `parent_name`). */
const NODES = [
  { name: "Ação", parent_name: null },
  { name: "Shooter", parent_name: "Ação" },
  { name: "Plataforma", parent_name: "Ação" },
  { name: "Luta", parent_name: "Ação" },
  { name: "RPG", parent_name: null },
  { name: "Roguelike", parent_name: "RPG" },
  { name: "Puzzle", parent_name: null },
  { name: "Casual e Party", parent_name: null },
];

describe("lib/gameGenres", () => {
  describe("genreKey", () => {
    test("ignora caixa, acento e espaço extra", () => {
      expect(genreKey("  AÇÃO  e   Aventura ")).toBe("acao e aventura");
      expect(genreKey("Point-and-Click")).toBe("point-and-click");
    });

    test("valor vazio vira string vazia (nunca 'undefined')", () => {
      expect(genreKey(null)).toBe("");
      expect(genreKey(undefined)).toBe("");
      expect(genreKey("   ")).toBe("");
    });
  });

  describe("normalizeGenreName", () => {
    test("apara e colapsa espaços", () => {
      expect(normalizeGenreName("  Hack   and Slash ")).toBe("Hack and Slash");
    });

    test("vazio vira null, para o chamador distinguir de nome válido", () => {
      expect(normalizeGenreName("")).toBeNull();
      expect(normalizeGenreName("   ")).toBeNull();
    });
  });

  describe("splitGenreNames", () => {
    test("quebra nos cinco separadores do valor legado", () => {
      expect(splitGenreNames("Puzzle, Ação/Plataforma|RPG;Luta\\Stealth")).toEqual(["Puzzle", "Ação", "Plataforma", "RPG", "Luta", "Stealth"]);
    });

    test("nunca parte um nome do catálogo ao meio", () => {
      // É esta garantia que separa "Beat 'em up" de "Hack and Slash": se algum
      // nome do catálogo tivesse `/`, ele voltaria em dois ao reprocessar.
      for (const node of NODES) {
        expect(splitGenreNames(node.name)).toEqual([node.name]);
      }
    });

    test("deduplica pela genreKey e descarta 'Indefinido'", () => {
      expect(splitGenreNames("Puzzle, puzzle, PUZZLE")).toEqual(["Puzzle"]);
      expect(splitGenreNames(`Ação, ${NO_GENRE}`)).toEqual(["Ação"]);
      expect(splitGenreNames("Indefinido")).toEqual([]);
    });

    test("string vazia ou nula não produz item fantasma", () => {
      expect(splitGenreNames("")).toEqual([]);
      expect(splitGenreNames(null)).toEqual([]);
      expect(splitGenreNames(" , / | ")).toEqual([]);
    });
  });

  describe("normalizeSelection", () => {
    test("deduplica ignorando caixa e acento", () => {
      expect(normalizeSelection(["Puzzle", "puzzle", "PUZZLE"], NODES)).toEqual(["Puzzle"]);
    });

    test("descarta o pai quando um filho dele está selecionado", () => {
      // Marcar "Ação" + "Shooter" gastaria 2 dos 5 slots para dizer a mesma
      // coisa — e o filtro por "Ação" já alcança o jogo pelo filho.
      expect(normalizeSelection(["Ação", "Shooter"], NODES)).toEqual(["Shooter"]);
    });

    test("mantém o pai quando o filho selecionado é de outro pai", () => {
      expect(normalizeSelection(["Ação", "Roguelike"], NODES)).toEqual(["Ação", "Roguelike"]);
    });

    test("remove o pai mesmo quando ele aparece depois do filho", () => {
      expect(normalizeSelection(["Shooter", "Ação"], NODES)).toEqual(["Shooter"]);
    });

    test("ignora nome fora do catálogo em vez de gravar texto livre", () => {
      expect(normalizeSelection(["Puzzle", "Gênero Inventado"], NODES)).toEqual(["Puzzle"]);
    });

    test("entrada que não é array devolve seleção vazia", () => {
      expect(normalizeSelection(null, NODES)).toEqual([]);
      expect(normalizeSelection("Puzzle", NODES)).toEqual([]);
    });

    test("preserva a ordem escolhida", () => {
      expect(normalizeSelection(["Puzzle", "Luta", "RPG"], NODES)).toEqual(["Puzzle", "Luta", "RPG"]);
    });
  });

  describe("genrePath", () => {
    test("usa o separador › só quando existe pai", () => {
      expect(genrePath({ name: "Shooter", parent_name: "Ação" })).toBe("Ação › Shooter");
      expect(genrePath({ name: "Puzzle", parent_name: null })).toBe("Puzzle");
    });

    test("nó ausente devolve string vazia", () => {
      expect(genrePath(null)).toBe("");
    });
  });

  test("o limite de gêneros por jogo é 5", () => {
    // O valor está aqui e não espalhado nas telas: mudar o teto é mudar uma
    // constante, e o teste existe para a mudança ser deliberada.
    expect(MAX_GAME_GENRES).toBe(5);
  });

  test("o default export expõe todas as funções nomeadas", () => {
    expect(gameGenres.genreKey).toBe(genreKey);
    expect(gameGenres.normalizeSelection).toBe(normalizeSelection);
    expect(gameGenres.splitGenreNames).toBe(splitGenreNames);
  });
});
