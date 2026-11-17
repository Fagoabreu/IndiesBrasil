import fs from "node:fs";
import path from "node:path";
import { LANDING_CATEGORIES, LANDING_COMMUNITY_STATS, parseSummaryCount } from "lib/landing";
import { HIGHLIGHT_TYPE_FEATURES, HIGHLIGHT_TYPES } from "lib/highlights";

/**
 * O mapa de categorias da home é a resposta visível para "o que existe aqui?"
 * — e o único lugar da primeira rolagem que leva ao catálogo inteiro.
 *
 * Um `href` digitado errado não quebra o build: o link renderiza bonito e
 * responde 404 no clique. Foi assim que `/images/og-cover.png` ficou meses no
 * ar. Este teste confere a página no disco, como `scripts/audit-*` fazem com
 * asset estático.
 */
const REPO_ROOT = process.cwd();
const PAGE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

function pageFileFor(href) {
  const relative = href.replace(/^\//, "");

  for (const extension of PAGE_EXTENSIONS) {
    const candidate = path.join(REPO_ROOT, "pages", relative, `index${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

describe("Portas de entrada da home", () => {
  test("cada porta aponta para uma página que existe", () => {
    const missing = LANDING_CATEGORIES.filter((category) => !pageFileFor(category.href)).map((category) => category.href);

    expect(missing).toEqual([]);
  });

  test("nenhuma porta se repete", () => {
    const hrefs = LANDING_CATEGORIES.map((category) => category.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("toda porta tem rótulo e diz o que tem dentro", () => {
    for (const category of LANDING_CATEGORIES) {
      expect(category.label.trim()).not.toBe("");
      expect(category.hint.trim()).not.toBe("");
      // Texto de interface em português: "Press kit", "Assets" e "boardgames"
      // eram jargão na primeira rolagem. A dica existe para traduzir a categoria.
      expect(category.hint).not.toMatch(/boardgame|press kit/i);
    }
  });

  test("toda porta tem ícone declarado", () => {
    for (const category of LANDING_CATEGORIES) {
      expect(typeof category.icon).toBe("string");
      expect(category.icon.trim()).not.toBe("");
    }
  });
});

describe("Números da comunidade", () => {
  test("cada número leva a uma listagem que existe", () => {
    const missing = LANDING_COMMUNITY_STATS.filter((stat) => !pageFileFor(stat.href)).map((stat) => stat.href);

    expect(missing).toEqual([]);
  });

  test("cada métrica existe no resumo do servidor", () => {
    // Nome de campo errado não quebra o build: a faixa simplesmente não aparece,
    // e a prova social da home desaparece sem nenhum erro.
    const serverStatus = fs.readFileSync(path.join(REPO_ROOT, "models", "serverStatus.js"), "utf8");

    for (const stat of LANDING_COMMUNITY_STATS) {
      expect(serverStatus).toContain(`AS ${stat.metric}`);
      expect(stat.plural.trim()).not.toBe("");
    }
  });

  test("a faixa não repete a mesma métrica", () => {
    const metrics = LANDING_COMMUNITY_STATS.map((stat) => stat.metric);

    expect(new Set(metrics).size).toBe(metrics.length);
  });
});

describe("parseSummaryCount", () => {
  test("aceita a string que o resumo do servidor devolve", () => {
    // `bigint` do Postgres chega como string: `user_accounts: "3"`.
    expect(parseSummaryCount("12")).toBe(12);
    expect(parseSummaryCount("1240")).toBe(1240);
  });

  test("zero, ausente e valor inválido não viram número", () => {
    expect(parseSummaryCount("0")).toBeNull();
    expect(parseSummaryCount(0)).toBeNull();
    expect(parseSummaryCount("")).toBeNull();
    expect(parseSummaryCount("abc")).toBeNull();
    expect(parseSummaryCount(undefined)).toBeNull();
    expect(parseSummaryCount(null)).toBeNull();
  });

  test("aceita número", () => {
    expect(parseSummaryCount(5)).toBe(5);
  });
});

describe("Gate dos destaques renderizados no servidor", () => {
  test("cada tipo de destaque tem uma feature de leitura", () => {
    for (const type of HIGHLIGHT_TYPES) {
      expect(HIGHLIGHT_TYPE_FEATURES[type]).toBeDefined();
    }
  });

  test("as features existem na lista do anônimo", () => {
    // `getServerSideProps` não passa pelo middleware: o gate é
    // `anonymousCan(feature)`. Feature fora de `ANONYMOUS_FEATURES` faria o
    // destaque desaparecer do HTML sem nenhum erro no servidor.
    const controller = fs.readFileSync(path.join(REPO_ROOT, "infra", "controller.js"), "utf8");

    for (const feature of Object.values(HIGHLIGHT_TYPE_FEATURES)) {
      expect(controller).toContain(`"${feature}"`);
    }
  });
});
