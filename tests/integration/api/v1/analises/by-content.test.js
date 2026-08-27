import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";
import contentReview from "models/content-review";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/analises/by-content", () => {
  let gameId;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorPorConteudo",
      email: "autor.por.conteudo@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456705,
    });

    const studio = await organization.create(authorCtx.user, { name: "Estúdio Por Conteúdo" });
    const createdGame = await game.create(studio.id, authorCtx.user.id, {
      name: "Jogo Por Conteúdo",
      stage: "concept",
    });
    gameId = createdGame.id;

    await contentReview.create({
      title: "Análise Por Conteúdo",
      authorId: authorCtx.user.id,
      contentType: "game",
      contentId: gameId,
      rating: 4,
    });
  });

  test("Anonymous user can list reviews by content", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/by-content?content_type=game&content_id=${gameId}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Análise Por Conteúdo");
  });

  test("Missing content_type returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/by-content?content_id=${gameId}`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toBe("content_type e content_id são obrigatórios.");
  });

  test("Missing content_id returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/by-content?content_type=game`);
    expect(response.status).toBe(400);
  });

  test("Unknown content returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/by-content?content_type=game&content_id=b80cfad3-f589-4c0f-b12d-df686093c2a7`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });
});
