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

describe("GET/PATCH /api/v1/boardgames/[slug]", () => {
  let ownerToken;
  let otherToken;
  let studio;
  let createdBoardgame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBoardDetalhe",
      email: "dono.board.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456822,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroBoardDetalhe",
      email: "outro.board.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456823,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Board Detalhe" });
    createdBoardgame = await boardgame.create(ownerCtx.user.id, studio.id, {
      name: "Jogo de Mesa Detalhe",
      short_description: "Descrição original",
      stage: "concept",
    });
  });

  test("Anonymous user can read boardgame detail", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Jogo de Mesa Detalhe");
    expect(body.slug).toBe(createdBoardgame.slug);
    expect(body.viewer).toMatchObject({
      isFollowing: false,
      canEdit: false,
      userReview: null,
    });
  });

  test("Owner reads detail with viewer context", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer).toMatchObject({
      isFollowing: false,
      canEdit: true,
      userReview: null,
    });
  });

  test("Reading a non-existent boardgame returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/board-inexistente`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ short_description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot update a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ short_description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can update a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ short_description: "Nova descrição" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.short_description).toBe("Nova descrição");
  });
});
