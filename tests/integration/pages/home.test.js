import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import book from "models/book";
import post from "models/post";
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
  let visiblePostId;

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

    // Sem post, a home não tinha nenhuma referência à rede social: o feed é a
    // metade do produto que a vitrine de catálogo não mostra.
    const createdPost = await post.create({ content: "Primeiro post da home", author_id: user.id });
    visiblePostId = createdPost.id;
  });

  test("o HTML traz o destaque e as portas de entrada", async () => {
    const response = await fetch(`${webserver.origin}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`href="/quadrinhos/${visibleSlug}"`);

    // Uma linha por tipo: o agrupamento é dito por um título, não só pelo selo
    // sobre a arte.
    expect(html).toContain("Livros e quadrinhos");
    expect(html).toContain('href="/quadrinhos"');

    // O mapa de categorias é o que responde "o que existe aqui?" mesmo quando
    // não há destaque nenhum no banco: ele não depende da API.
    expect(html).toContain('href="/jogos-de-mesa"');
    expect(html).toContain('href="/assets"');
    expect(html).toContain('href="/servicos"');
    expect(html).toContain('href="/posts"');

    // A prévia do feed também sai no HTML: a home se apresenta como rede social
    // e precisa mostrar a conversa, não só o catálogo.
    expect(html).toContain(`href="/posts/${visiblePostId}"`);
  });

  test("não anuncia obra bloqueada pela moderação", async () => {
    const response = await fetch(`${webserver.origin}/`);
    const html = await response.text();

    expect(html).not.toContain(blockedSlug);
  });
});
