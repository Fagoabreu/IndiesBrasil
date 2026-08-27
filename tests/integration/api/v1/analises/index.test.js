import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/POST /api/v1/analises", () => {
  let authorToken;
  let gameId;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorAnalise",
      email: "autor.analise@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456704,
    });
    authorToken = authorCtx.sessionToken;

    const studio = await organization.create(authorCtx.user, { name: "Estúdio Análise" });
    const createdGame = await game.create(studio.id, authorCtx.user.id, {
      name: "Jogo Para Análise",
      genre: "Aventura",
      stage: "released",
    });
    gameId = createdGame.id;
  });

  test("Anonymous user can list reviews", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Anonymous user cannot create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Análise Anônima", content_type: "game", content_id: gameId }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises`, {
      method: "POST",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({
        title: "Análise do Jogo Para Análise",
        content_type: "game",
        content_id: gameId,
        rating: 5,
        sections: [],
        positive_points: ["Ótima história"],
        negative_points: [],
      }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.title).toBe("Análise do Jogo Para Análise");
    expect(body.content_type).toBe("game");
    expect(body.rating).toBe(5);
    expect(body.slug).toBeTruthy();
  });

  test("Creating with invalid content_type returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises`, {
      method: "POST",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Tipo Errado", content_type: "filme", content_id: gameId }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Creating without title returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises`, {
      method: "POST",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({ content_type: "game", content_id: gameId }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Creating with rating out of range returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises`, {
      method: "POST",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Nota Inválida", content_type: "game", content_id: gameId, rating: 9 }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });
});
