import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import { createSeoFixtures, hubLinks } from "tests/helpers/seoTestFixtures";

/**
 * As listagens precisam **linkar** as entidades no HTML que sai do servidor.
 *
 * Sitemap publicado não basta: sem link nenhum, o Google só chega a um jogo se
 * executar JavaScript, conseguir chamar `/api/v1/*` e ainda descobrir o
 * endereço sozinho. Antes desta mudança os sete hubs eram `"use client"` com
 * busca em `useEffect`, então o HTML servido era um spinner — zero
 * `<a href="/jogos/...">` em todas as listagens.
 *
 * É o tipo de regressão que não aparece em teste nenhum: a página continua
 * funcionando perfeitamente no navegador.
 */

const origin = webserver.origin;

async function fetchHtml(path) {
  const response = await fetch(`${origin}${path}`);
  return { response, html: await response.text() };
}

describe("Listagens (HTML servido)", () => {
  let fixtures;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    fixtures = await createSeoFixtures();
  });

  test("Cada listagem linka as entidades do seu tipo sem depender de JavaScript", async () => {
    for (const [hub, entityPath] of Object.entries(hubLinks(fixtures))) {
      const { response, html } = await fetchHtml(hub);

      expect(response.status).toBe(200);
      expect(html).toContain(`href="${entityPath}"`);
    }
  });

  test("Nenhuma listagem linka conteúdo bloqueado pela moderação", async () => {
    const { html } = await fetchHtml("/jogos");

    expect(html).not.toContain(`href="/jogos/${fixtures.blockedGameSlug}"`);
  });
});
