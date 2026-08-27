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

describe("GET/POST /api/v1/content-rating", () => {
  let ownerToken;
  let gameSlug;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoRating",
      email: "dono.rating@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456703,
    });
    ownerToken = ownerCtx.sessionToken;

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Rating" });
    const createdGame = await game.create(studio.id, ownerCtx.user.id, {
      name: "Jogo Classificado",
      genre: "Ação",
      stage: "concept",
    });
    gameSlug = createdGame.slug;
  });

  test("Anonymous user can fetch the game questionnaire", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating?type=game`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toContain("Jogo Digital");
    expect(Array.isArray(body.sections)).toBe(true);
  });

  test("Fetching without type returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.status_code).toBe(400);
  });

  test("Fetching with invalid type returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating?type=filme`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.status_code).toBe(400);
  });

  test("Anonymous user cannot calculate (requires auth)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "calculate", type: "game", answers: { v_arms: "L" } }),
    });
    expect(response.status).toBe(401);
  });

  test("Activated user can calculate a rating", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ action: "calculate", type: "game", answers: { v_arms: "18" } }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.rating).toBe("18");
    expect(body.label).toBe("18 anos");
    expect(Array.isArray(body.reasons)).toBe(true);
  });

  test("Calculate with empty answers returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ action: "calculate", type: "game", answers: {} }),
    });
    expect(response.status).toBe(400);
  });

  test("Save with invalid action returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ action: "invalid", type: "game" }),
    });
    expect(response.status).toBe(400);
  });

  test("Save without slug returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ action: "save", type: "game", rating: "10" }),
    });
    expect(response.status).toBe(400);
  });

  test("Save with invalid rating returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ action: "save", type: "game", slug: gameSlug, rating: "99" }),
    });
    expect(response.status).toBe(400);
  });

  test("Activated user can save a rating for an existing game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        action: "save",
        type: "game",
        slug: gameSlug,
        rating: "10",
        reasons: ["Violência leve"],
      }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.rating).toBe("10");
    expect(body.label).toBe("10 anos");
    expect(body.slug).toBe(gameSlug);
    expect(body.type).toBe("game");
  });

  test("Save for non-existent slug returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/content-rating`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ action: "save", type: "game", slug: "jogo-inexistente", rating: "10" }),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });
});
