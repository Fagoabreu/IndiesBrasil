import fs from "node:fs";
import path from "node:path";
import controller from "@/infra/controller";

/**
 * O contrato de leitura pública tem dois lados que precisam concordar:
 *
 *  - `infra/controller.js` (`ANONYMOUS_FEATURES`) diz **o que** o visitante sem
 *    sessão pode ler;
 *  - as páginas que montam conteúdo no servidor dizem **o que elas leem**
 *    (`anonymousCan("<feature>")`), porque `getServerSideProps` não passa pelo
 *    middleware.
 *
 * Se os dois saírem de sincronia o efeito é silencioso nos dois sentidos:
 * revogar uma feature da lista faz uma página pública passar a responder 404, e
 * acrescentar uma leitura sem a feature correspondente faz a página servir
 * conteúdo que a API esconde.
 *
 * A checagem é no **código-fonte** de propósito: o que precisa ser verdade é
 * que a feature usada na página exista na lista, e um teste de comportamento
 * cobriria só o estado de hoje (as duas listas estão corretas agora; o risco é
 * alguém editar uma e esquecer a outra).
 */

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const PAGES_DIR = path.join(REPO_ROOT, "pages");
const API_DIR = path.join(PAGES_DIR, "api");

/** Arquivos de página (não-API) que consultam a lista do controller. */
function pagesUsingAnonymousCan(dir) {
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // `pages/api` não entra: lá o gate é o middleware, que já usa a mesma
      // lista — checar de novo mediria a mesma coisa duas vezes.
      if (fullPath === API_DIR) continue;
      found.push(...pagesUsingAnonymousCan(fullPath));
      continue;
    }

    if (!/\.jsx?$/.test(entry.name)) continue;

    const source = fs.readFileSync(fullPath, "utf8");
    for (const match of source.matchAll(/anonymousCan\("([^"]+)"\)/g)) {
      found.push({ file: path.relative(REPO_ROOT, fullPath).replaceAll("\\", "/"), feature: match[1] });
    }
  }

  return found;
}

describe("Leitura pública no servidor", () => {
  const usages = pagesUsingAnonymousCan(PAGES_DIR);

  test("As páginas que leem conteúdo no servidor consultam a lista do controller", () => {
    // Guarda contra a regressão que originou a checagem: as páginas chamavam o
    // model direto e o gate do controller ficava só nas rotas de API.
    expect(usages.length).toBeGreaterThan(0);
  });

  test("Toda feature usada por uma página é concedida ao anônimo", () => {
    const anonymousFeatures = controller.getAnonymousUser().features;

    const missing = usages.filter((usage) => !anonymousFeatures.includes(usage.feature));

    // A mensagem nomeia o arquivo: sem isso o erro é só "uma feature sumiu", e
    // quem a removeu da lista não sabe quais páginas deixou quebradas.
    expect(missing.map((usage) => `${usage.file} depende de "${usage.feature}"`)).toEqual([]);
  });

  test("As features usadas existem no catálogo de permissões", () => {
    // `authorization.can` valida contra `availableFeatures` e lança em nome
    // desconhecido — um `anonymousCan("read:jogo")` derrubaria a página inteira
    // em vez de negar acesso. Chamar cada uma é o que expõe o erro de digitação.
    for (const usage of usages) {
      expect(() => controller.anonymousCan(usage.feature)).not.toThrow();
    }
  });

  test("Cada tipo de conteúdo do sitemap declara uma feature válida e anônima", async () => {
    const { ENTITY_SITEMAPS } = await import("@/lib/sitemap");
    const anonymousFeatures = controller.getAnonymousUser().features;

    for (const entry of ENTITY_SITEMAPS) {
      expect(() => controller.anonymousCan(entry.feature)).not.toThrow();
      expect(anonymousFeatures).toContain(entry.feature);
    }
  });
});
