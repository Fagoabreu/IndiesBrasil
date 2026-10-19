import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import { createSeoFixtures } from "tests/helpers/seoTestFixtures";

/**
 * A página do asset é montada no servidor.
 *
 * Um asset não tem arquivo hospedado aqui — o que a página publica é a ficha
 * (nome, categorias, licença) e o link para a origem. Se o SSR quebrar, o
 * visitante que chega pelo sitemap ou por um link compartilhado recebe um
 * spinner; e o Google, uma página sem conteúdo.
 */
const origin = webserver.origin;

async function fetchHtml(path) {
  const response = await fetch(`${origin}${path}`);
  return { response, html: await response.text() };
}

describe("Páginas de asset (HTML servido)", () => {
  let fixtures;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    fixtures = await createSeoFixtures();
  });

  test("A página do asset é servida com nome, categorias e link externo", async () => {
    const { response, html } = await fetchHtml(`/assets/${fixtures.assetSlug}`);

    expect(response.status).toBe(200);
    expect(html).toContain("Asset Sitemap");
    expect(html).toContain("Sprites");
    // O endereço de origem é o que o visitante precisa para baixar o asset.
    expect(html).toContain("https://exemplo.itch.io/asset-sitemap");
  });

  test("Asset bloqueado responde 404", async () => {
    const { response } = await fetchHtml(`/assets/${fixtures.blockedAssetSlug}`);

    expect(response.status).toBe(404);
  });

  test("A listagem publica as categorias no filtro", async () => {
    const { response, html } = await fetchHtml("/assets");

    expect(response.status).toBe(200);
    expect(html).toContain("Sprites");
    expect(html).toContain("Arte 2D");
  });
});
