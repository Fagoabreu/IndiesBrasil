import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import database from "infra/database";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import book from "models/book";
import asset from "models/asset";
import moderation from "models/moderation";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

/**
 * `cover_image_id` é FK para `uploaded_images`, cujo `filename` é NOT NULL.
 * Inserir a linha direto evita depender do Cloudinary: o endpoint lê só o
 * `secure_url`.
 */
let imageSequence = 0;
async function createCoverImage(secureUrl) {
  imageSequence += 1;
  const id = `test-highlight-img-${imageSequence}`;

  await database.query({
    text: `INSERT INTO uploaded_images (id, filename, secure_url) VALUES ($1, $2, $3)`,
    values: [id, `${id}.png`, secureUrl],
  });

  return id;
}

describe("GET /api/v1/highlights", () => {
  test("Anonymous user gets an empty list when there is no content", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/highlights`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Anonymous user gets a highlight for a book with a cover", async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "EstudioDestaque",
      email: "estudio.destaque@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456705,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Destaque" });
    const createdBook = await book.create(ownerCtx.user.id, studio.id, { title: "Livro Em Destaque" });
    await book.update(createdBook.slug, { cover_url_external: "https://example.com/capa.jpg" });

    const response = await fetch(`${webserver.origin}/api/v1/highlights`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);

    const highlight = body.find((item) => item.type === "book");
    expect(highlight).toBeDefined();
    expect(highlight.slug).toBe(createdBook.slug);
    expect(highlight.name).toBe("Livro Em Destaque");
  });

  test("Devolve no máximo 3 itens por tipo e inclui assets que têm capa", async () => {
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();

    const ownerCtx = await createActivatedUserWithSession({
      username: "EstudioLimite",
      email: "estudio.limite@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456706,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Limite" });

    // 5 livros com capa: o endpoint não pode devolver os 5.
    for (let index = 0; index < 5; index++) {
      const created = await book.create(ownerCtx.user.id, studio.id, { title: `Livro ${index}` });
      await book.update(created.slug, { cover_url_external: `https://example.com/capa-${index}.jpg` });
    }

    // 2 assets com capa entram; o terceiro, sem capa, não (o card é a arte).
    for (let index = 0; index < 2; index++) {
      const created = await asset.create(ownerCtx.user.id, studio.id, {
        name: `Asset Com Capa ${index}`,
        external_url: "https://exemplo.itch.io/asset",
        is_free: true,
      });
      const coverId = await createCoverImage(`https://res.cloudinary.com/demo/image/upload/asset-${index}.png`);
      await asset.saveCover(created.slug, coverId);
    }
    await asset.create(ownerCtx.user.id, studio.id, {
      name: "Asset Sem Capa",
      external_url: "https://exemplo.itch.io/asset-sem-capa",
      is_free: true,
    });

    const response = await fetch(`${webserver.origin}/api/v1/highlights`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.filter((item) => item.type === "book")).toHaveLength(3);
    expect(body.filter((item) => item.type === "asset")).toHaveLength(2);
    expect(body.map((item) => item.name)).not.toContain("Asset Sem Capa");

    // Nenhuma linha sem `type`: o card depende dele para rótulo e rota.
    expect(body.every((item) => ["game", "boardgame", "book", "asset"].includes(item.type))).toBe(true);
  });

  test("Conteúdo bloqueado pela moderação não vira destaque", async () => {
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();

    const ownerCtx = await createActivatedUserWithSession({
      username: "EstudioBloqueio",
      email: "estudio.bloqueio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456707,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Bloqueio" });
    const created = await book.create(ownerCtx.user.id, studio.id, { title: "Livro Bloqueado" });
    await book.update(created.slug, { cover_url_external: "https://example.com/bloqueado.jpg" });

    // Sem filtro, este card apareceria na home apontando para uma página 404.
    await moderation.createBlock({
      targetType: "book",
      targetId: created.id,
      reason: "violacao_termos",
      moderatorId: ownerCtx.user.id,
    });

    const response = await fetch(`${webserver.origin}/api/v1/highlights`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.map((item) => item.name)).not.toContain("Livro Bloqueado");
  });
});
