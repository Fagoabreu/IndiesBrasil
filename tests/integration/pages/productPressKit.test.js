import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import { createSeoFixtures } from "tests/helpers/seoTestFixtures";

/**
 * Press kit de produto servido no HTML.
 *
 * O documento precisa chegar pronto do servidor: quem abre o link é a imprensa,
 * muitas vezes sem JavaScript (ou com o script bloqueado pelo leitor de PDF).
 * Se o SSR quebrar, a página vira spinner — e a regressão é silenciosa no
 * navegador de quem tem os dados em cache.
 *
 * O caso do conteúdo bloqueado é o mais fácil de esquecer: um teste que só
 * confere presença passa com o press kit de um jogo moderado publicado.
 */
const origin = webserver.origin;

async function fetchHtml(path) {
  const response = await fetch(`${origin}${path}`);
  return { response, html: await response.text() };
}

describe("Press kit de produto (HTML servido)", () => {
  let fixtures;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();

    fixtures = await createSeoFixtures();
  });

  test("Jogo: documento traz factsheet, estúdio e o nome do produto", async () => {
    const { response, html } = await fetchHtml(`/jogos/${fixtures.gameRow.slug}/press-kit`);

    expect(response.status).toBe(200);
    expect(html).toContain("Jogo Sitemap");
    expect(html).toContain("Factsheet");
    expect(html).toContain("Estúdio Sitemap");
    expect(html).toContain("Desenvolvedor");
  });

  test("Jogo de mesa: mesma estrutura, com o produto certo", async () => {
    const { response, html } = await fetchHtml(`/jogos-de-mesa/${fixtures.boardgameSlug}/press-kit`);

    expect(response.status).toBe(200);
    expect(html).toContain("Jogo de Mesa Sitemap");
    expect(html).toContain("Factsheet");
  });

  test("Quadrinho/livro: mesma estrutura, com o produto certo", async () => {
    const { response, html } = await fetchHtml(`/quadrinhos/${fixtures.bookSlug}/press-kit`);

    expect(response.status).toBe(200);
    expect(html).toContain("Livro Sitemap");
    expect(html).toContain("Factsheet");
  });

  test("O documento é noindex — repete o conteúdo da página do produto", async () => {
    const { html } = await fetchHtml(`/jogos/${fixtures.gameRow.slug}/press-kit`);

    expect(html).toContain('content="noindex, nofollow"');
  });

  test("Produto bloqueado pela moderação responde 404", async () => {
    const { response } = await fetchHtml(`/jogos/${fixtures.blockedGameSlug}/press-kit`);

    expect(response.status).toBe(404);
  });

  test("Slug inexistente responde 404, não documento vazio", async () => {
    const { response } = await fetchHtml("/jogos/jogo-que-nao-existe/press-kit");

    expect(response.status).toBe(404);
  });

  test("A página do produto publica o link do press kit", async () => {
    // Sem o botão na página, o documento existe mas ninguém chega nele por
    // navegação — só por URL adivinhada.
    const { html } = await fetchHtml(`/jogos/${fixtures.gameRow.slug}`);
    expect(html).toContain(`/jogos/${fixtures.gameRow.slug}/press-kit`);

    const { html: bgHtml } = await fetchHtml(`/jogos-de-mesa/${fixtures.boardgameSlug}`);
    expect(bgHtml).toContain(`/jogos-de-mesa/${fixtures.boardgameSlug}/press-kit`);

    const { html: bookHtml } = await fetchHtml(`/quadrinhos/${fixtures.bookSlug}`);
    expect(bookHtml).toContain(`/quadrinhos/${fixtures.bookSlug}/press-kit`);
  });
});
