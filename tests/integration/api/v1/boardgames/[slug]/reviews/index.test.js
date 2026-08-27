import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import boardgame from "models/boardgame";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/POST/PATCH /api/v1/boardgames/[slug]/reviews", () => {
  let reviewerToken;
  let studio;
  let createdBoardgame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBoardReview",
      email: "dono.board.review@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456826,
    });

    const reviewerCtx = await createActivatedUserWithSession({
      username: "AvaliadorBoard",
      email: "avaliador.board@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456827,
    });
    reviewerToken = reviewerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Board Review" });
    createdBoardgame = await boardgame.create(ownerCtx.user.id, studio.id, {
      name: "Board Avaliado",
    });
  });

  test("Anonymous user can list reviews", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`, {
      method: "POST",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 4, content: "Bom jogo de mesa" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.rating).toBe(4);
    expect(body.content).toBe("Bom jogo de mesa");
  });

  test("Reviews list includes the created review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].rating).toBe(4);
    expect(body[0].username).toBe("AvaliadorBoard");
  });

  test("Reviewer can edit their review via PATCH", async () => {
    const listResponse = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`);
    const reviews = await listResponse.json();
    const reviewId = reviews[0].id;

    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`, {
      method: "PATCH",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ reviewId, rating: 2, content: "Atualizado" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.rating).toBe(2);
    expect(body.content).toBe("Atualizado");
  });

  test("PATCH without reviewId returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/reviews`, {
      method: "PATCH",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    });
    expect(response.status).toBe(400);
  });
});
