import {
  PROFESSION_GROUPS,
  PROFESSION_GROUP_KEYS,
  groupProfessions,
  isValidProfessionGroup,
  normalizeProfessionName,
  professionGroupLabel,
  professionKey,
} from "@/lib/professionGroups";
import { PROFESSION_ICONS, isValidProfessionIcon, professionIconLabel } from "@/lib/professionIcons";

/**
 * Registro dos grupos de profissão e dos ícones disponíveis.
 *
 * O que este teste protege:
 *
 * 1. **A ordem dos grupos é fixa e única** — o seletor do perfil, a tela de admin
 *    e o agrupamento leem daqui; um grupo repetido faria a mesma seção aparecer
 *    duas vezes.
 * 2. **Comparar nomes tolera acento e caixa** — enquanto `portfolio_roles.name`
 *    era enum, o banco garantia que "Programador de Jogos" e "programador de
 *    jogos" fossem a mesma coisa. Agora é texto, e a checagem de duplicata
 *    depende desta função.
 * 3. **Todo ícone declarado tem arquivo** — sem isso, o perfil de quem declara a
 *    especialidade mostra imagem quebrada, e o erro só aparece no navegador.
 */
describe("lib/professionGroups.js", () => {
  test("os grupos existem, em ordem e sem repetição", () => {
    expect(PROFESSION_GROUPS.length).toBeGreaterThan(0);
    expect(new Set(PROFESSION_GROUP_KEYS).size).toBe(PROFESSION_GROUPS.length);

    const orders = PROFESSION_GROUPS.map((group) => group.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  test("cada grupo tem chave e rótulo legíveis", () => {
    for (const group of PROFESSION_GROUPS) {
      expect(group.key).toMatch(/^[a-z-]+$/);
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  test("isValidProfessionGroup aceita só as chaves declaradas", () => {
    expect(isValidProfessionGroup("arte")).toBe(true);
    expect(isValidProfessionGroup("artes")).toBe(false);
    expect(isValidProfessionGroup("")).toBe(false);
    expect(isValidProfessionGroup(null)).toBe(false);
  });

  test("rótulo de grupo desconhecido volta cru em vez de sumir", () => {
    expect(professionGroupLabel("programacao")).toBe("Programação");
    expect(professionGroupLabel("inexistente")).toBe("inexistente");
  });

  test("agrupar ordena pelos grupos fixos e não perde profissão", () => {
    const professions = [
      { name: "Analista QA", group_key: "producao", display_order: 0 },
      { name: "Artista 2D", group_key: "arte", display_order: 0 },
      { name: "Animador", group_key: "arte", display_order: 1 },
    ];

    const grouped = groupProfessions(professions);

    expect(grouped.map((group) => group.key)).toEqual(["arte", "producao"]);
    expect(grouped[0].professions.map((item) => item.name)).toEqual(["Artista 2D", "Animador"]);
  });

  test("grupo sem profissão não vira seção vazia", () => {
    const grouped = groupProfessions([{ name: "Escritor", group_key: "conteudo", display_order: 0 }]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].professions).toHaveLength(1);
  });

  test("profissão de grupo desconhecido não aparece (dado órfão)", () => {
    // Não deve acontecer — `group_key` é NOT NULL e validado na escrita —, mas o
    // teste fixa que o agrupamento não explode com uma linha estranha.
    const grouped = groupProfessions([{ name: "X", group_key: "inventado", display_order: 0 }]);
    expect(grouped).toEqual([]);
  });

  test("a chave de comparação ignora acento, caixa e espaço extra", () => {
    expect(professionKey("Programador de Jogos")).toBe(professionKey("programador de jogos"));
    expect(professionKey("  Artista  3D  ")).toBe("artista 3d");
    expect(professionKey("Designer de Nível")).toBe(professionKey("designer de nivel"));
    expect(professionKey(null)).toBe("");
  });

  test("normalizar o nome apara e colapsa espaços, e vazio vira null", () => {
    expect(normalizeProfessionName("  Artista   2D ")).toBe("Artista 2D");
    expect(normalizeProfessionName("   ")).toBeNull();
    expect(normalizeProfessionName(undefined)).toBeNull();
  });
});

describe("lib/professionIcons.js", () => {
  test("cada ícone declarado tem arquivo em public/images/professions", () => {
    const fs = require("node:fs");
    const path = require("node:path");

    const dir = path.join(process.cwd(), "public", "images", "professions");

    for (const icon of PROFESSION_ICONS) {
      const file = path.join(dir, `${icon.key}.png`);
      expect({ key: icon.key, exists: fs.existsSync(file) }).toEqual({ key: icon.key, exists: true });
    }
  });

  test("os ícones não se repetem", () => {
    const keys = PROFESSION_ICONS.map((icon) => icon.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("a validação aceita só o que está na lista", () => {
    expect(isValidProfessionIcon("GameDesigner")).toBe(true);
    expect(isValidProfessionIcon("NaoExiste")).toBe(false);
    expect(isValidProfessionIcon("")).toBe(false);
    expect(isValidProfessionIcon(null)).toBe(false);
  });

  test("rótulo do ícone desconhecido volta cru", () => {
    expect(professionIconLabel("Writer")).toBe("Escritor");
    expect(professionIconLabel("NaoExiste")).toBe("NaoExiste");
  });
});
