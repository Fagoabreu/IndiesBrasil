import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import book from "models/book";
import moderation from "models/moderation";

/**
 * A home precisa **linkar** conteúdo no HTML que sai do servidor.
 *
 * Os destaques eram buscados em `useEffect`: o HTML servido era a arte do site
 * e texto de marketing, sem nenhum link de obra. Para quem chega de fora — e
 * para o Google — a plataforma parecia não ter catálogo, e a primeira dobra não
 * respondia "o que existe aqui?".
 *
 * É o mesmo tipo de regressão de `hubs.test.js`: a página continua funcionando
 * no navegador, e só o HTML denuncia.
 */
describe("Home (HTML servido)", () => {
  let visibleSlug;
  let blockedSlug;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    const { user } = await createActivatedUserWithSession({
      username: "EstudioHome",
      email: "estudio.home@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456709,
    });

    const studio = await organization.create(user, { name: "Estúdio da Home" });

    // Livro com capa externa é o destaque mais barato de montar: não depende de
    // upload no Cloudinary, e a capa é o que define "tem imagem" na query.
    const visible = await book.create(user.id, studio.id, { title: "Livro em destaque na home" });
    await book.update(visible.slug, { cover_url_external: "https://example.com/capa-home.jpg" });
    visibleSlug = visible.slug;

    const blocked = await book.create(user.id, studio.id, { title: "Livro bloqueado na home" });
    await book.update(blocked.slug, { cover_url_external: "https://example.com/capa-bloqueada.jpg" });
    blockedSlug = blocked.slug;

    await moderation.createBlock({
      targetType: "book",
      targetId: blocked.id,
      reason: "violacao_termos",
      moderatorId: user.id,
    });
  });

  test("o HTML traz o destaque e as portas de entrada", async () => {
    const response = await fetch(`${webserver.origin}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`href="/quadrinhos/${visibleSlug}"`);

    // O mapa de categorias é o que responde "o que existe aqui?" mesmo quando
    // não há destaque nenhum no banco: ele não depende da API.
    expect(html).toContain('href="/jogos-de-mesa"');
    expect(html).toContain('href="/assets"');
    expect(html).toContain('href="/servicos"');
  });

  test("não anuncia obra bloqueada pela moderação", async () => {
    const response = await fetch(`${webserver.origin}/`);
    const html = await response.text();

    expect(html).not.toContain(blockedSlug);
  });
});
