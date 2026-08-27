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

describe("GET/PATCH/DELETE /api/v1/games/[slug]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let studio;
  let createdGame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoJogoDetalhe",
      email: "dono.jogo.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456802,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroJogoDetalhe",
      email: "outro.jogo.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456803,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Jogo Detalhe" });
    createdGame = await game.create(studio.id, owner.id, {
      name: "Jogo Detalhe",
      short_description: "Descrição original",
      stage: "concept",
    });
  });

  test("Anonymous user can read game detail", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Jogo Detalhe");
    expect(body.slug).toBe(createdGame.slug);
    expect(body.viewer).toMatchObject({
      isFollowing: false,
      canEdit: false,
      userReview: null,
    });
    expect(Array.isArray(body.platforms)).toBe(true);
    expect(Array.isArray(body.media)).toBe(true);
    expect(Array.isArray(body.team)).toBe(true);
    expect(Array.isArray(body.store_pages)).toBe(true);
    expect(Array.isArray(body.tags)).toBe(true);
  });

  test("Owner reads detail with viewer context", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
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

  test("Reading a non-existent game returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/jogo-inexistente`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ short_description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot update a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ short_description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can update a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ short_description: "Nova descrição" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.short_description).toBe("Nova descrição");
  });

  test("Anonymous user cannot delete a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot delete a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
