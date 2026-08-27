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

describe("GET/POST/DELETE /api/v1/games/[slug]/media", () => {
  let ownerToken;
  let otherToken;
  let studio;
  let createdGame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoJogoMedia",
      email: "dono.jogo.media@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456809,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroJogoMedia",
      email: "outro.jogo.media@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456810,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Jogo Media" });
    createdGame = await game.create(studio.id, ownerCtx.user.id, {
      name: "Jogo com Media",
    });
  });

  test("Anonymous user can list media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot add media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc123" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot add media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc123" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can add media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc123", caption: "Trailer" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.media_type).toBe("video");
    expect(body.url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(body.caption).toBe("Trailer");
  });

  test("Owner cannot add media without URL", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ caption: "Sem URL" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Media list includes the created media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].url).toBe("https://www.youtube.com/watch?v=abc123");
  });
});
