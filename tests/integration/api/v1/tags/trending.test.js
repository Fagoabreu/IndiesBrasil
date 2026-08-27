import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import tags from "models/tags";
import post from "models/post";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/tags/trending", () => {
  describe("Without any tags", () => {
    test("Returns 404 when there are no tagged posts", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/tags/trending?period=7d`);
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.name).toBe("NotFoundError");
    });
  });

  describe("With tagged posts", () => {
    beforeAll(async () => {
      const ctx = await createActivatedUserWithSession({
        username: "AutorTrending",
        email: "autor.trending@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: 90123456704,
      });

      const tag = await tags.create("indie");
      await post.create({
        author_id: ctx.user.id,
        content: "Lançando meu jogo #indie hoje!",
        tags: [{ id: tag.id }],
      });
    });

    test("Anonymous user gets trending tags", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/tags/trending?period=7d`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.length).toBeGreaterThan(0);
      expect(body[0].name).toBe("indie");
      expect(Number(body[0].usage_count)).toBe(1);
    });

    test("Invalid period returns 400", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/tags/trending?period=abc`);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.name).toBe("ValidationError");
    });
  });
});
