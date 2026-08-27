import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import book from "models/book";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

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
});
