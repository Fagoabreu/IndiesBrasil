import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";

/**
 * Status HTTP das páginas de conteúdo — o que o Search Console lê.
 *
 * O relatório "Página com redirecionamento" tinha páginas de jogo e quadrinho
 * porque o `getServerSideProps` devolvia 200 com a casca e o cliente redirecionava
 * para a listagem. E "Erro soft 404" aparecia em estúdio inexistente (200 com
 * "Estúdio não encontrado.") e no press kit do estúdio (200 com "Carregando...").
 *
 * A regra que este arquivo fixa: **conteúdo inexistente responde 404 de verdade**.
 * Um 200 seguido de redirect no cliente não indexa nada e ainda gasta orçamento
 * de rastreamento; um 404 é inequívoco e o Google remove a URL do índice.
 */
const origin = webserver.origin;

async function status(path) {
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  return response.status;
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("Status das páginas de conteúdo", () => {
  test("produto inexistente responde 404, não redirect", async () => {
    expect(await status("/jogos/slug-que-nao-existe")).toBe(404);
    expect(await status("/jogos-de-mesa/slug-que-nao-existe")).toBe(404);
    expect(await status("/quadrinhos/slug-que-nao-existe")).toBe(404);
  });

  test("estúdio inexistente responde 404", async () => {
    // `medalha-zero` estava no relatório de soft 404: a página devolvia 200 com
    // "Estúdio não encontrado.".
    expect(await status("/estudios/slug-que-nao-existe")).toBe(404);
  });

  test("press kit de estúdio inexistente responde 404, inclusive no endereço literal", async () => {
    expect(await status("/estudios/slug-que-nao-existe/press-kit")).toBe(404);
    // O literal `[slug]` apareceu na documentação e o Google tentou a URL. Ela
    // respondia 200 com "Carregando press kit...".
    expect(await status("/estudios/%5Bslug%5D/press-kit")).toBe(404);
  });

  test("formulário de análise é noindex", async () => {
    const response = await fetch(`${origin}/analises/novo`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('content="noindex');
  });

  test("conteúdo existente continua respondendo 200", async () => {
    // Contraponto dos 404 acima: `findBySlug` lança `NotFoundError` quando não
    // acha — o tratamento novo não pode transformar página válida em 404.
    const { user } = await createActivatedUserWithSession({
      username: "EstudioSeoStatus",
      email: "estudio.seo.status@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456711,
    });

    const studio = await organization.create(user, { name: "Estúdio SEO Status" });
    const published = await game.create(studio.id, user.id, { name: "Jogo SEO Status", stage: "released" });

    expect(await status(`/jogos/${published.slug}`)).toBe(200);
    expect(await status(`/estudios/${studio.slug}`)).toBe(200);

    // Press kit do estúdio é documento duplicado: continua 200 para quem tem o
    // link, mas sai do índice — e o `noindex` precisa estar no HTML **servido**,
    // não só depois do carregamento no cliente.
    const kit = await fetch(`${origin}/estudios/${studio.slug}/press-kit`);
    const kitHtml = await kit.text();
    expect(kit.status).toBe(200);
    expect(kitHtml).toContain('content="noindex');
  });
});
