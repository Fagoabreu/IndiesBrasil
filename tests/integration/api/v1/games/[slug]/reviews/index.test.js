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

describe("GET/POST/PATCH /api/v1/games/[slug]/reviews", () => {
  let reviewerToken;
  let studio;
  let createdGame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoJogoReview",
      email: "dono.jogo.review@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456806,
    });

    const reviewerCtx = await createActivatedUserWithSession({
      username: "AvaliadorJogo",
      email: "avaliador.jogo@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456807,
    });
    reviewerToken = reviewerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Jogo Review" });
    createdGame = await game.create(studio.id, ownerCtx.user.id, {
      name: "Jogo Avaliado",
    });
  });

  test("Anonymous user can list reviews", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`, {
      method: "POST",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 5, content: "Ótimo jogo" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.rating).toBe(5);
    expect(body.content).toBe("Ótimo jogo");
  });

  test("Reviews list includes the created review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].rating).toBe(5);
    expect(body[0].username).toBe("AvaliadorJogo");
  });

  test("User cannot review the same game twice", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`, {
      method: "POST",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Invalid rating returns 400", async () => {
    const otherCtx = await createActivatedUserWithSession({
      username: "OutroAvaliadorJogo",
      email: "outro.avaliador.jogo@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456808,
    });

    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`, {
      method: "POST",
      headers: { ...authHeaders(otherCtx.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 9 }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Reviewer can edit their review via PATCH", async () => {
    const listResponse = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`);
    const reviews = await listResponse.json();
    const reviewId = reviews[0].id;

    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`, {
      method: "PATCH",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ reviewId, rating: 3, content: "Atualizado" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.rating).toBe(3);
    expect(body.content).toBe("Atualizado");
  });

  test("PATCH without reviewId returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/reviews`, {
      method: "PATCH",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    });
    expect(response.status).toBe(400);
  });
});
