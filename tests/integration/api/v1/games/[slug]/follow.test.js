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

describe("POST/DELETE /api/v1/games/[slug]/follow", () => {
  let followerToken;
  let studio;
  let createdGame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoJogoFollow",
      email: "dono.jogo.follow@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456804,
    });

    const followerCtx = await createActivatedUserWithSession({
      username: "SeguidorJogo",
      email: "seguidor.jogo@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456805,
    });
    followerToken = followerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Jogo Follow" });
    createdGame = await game.create(studio.id, ownerCtx.user.id, {
      name: "Jogo Seguido",
    });
  });

  test("Anonymous user cannot follow a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/follow`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can follow a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ following: true });
  });

  test("Detail reflects following state after follow", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`, {
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer.isFollowing).toBe(true);
  });

  test("Anonymous user cannot unfollow a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/follow`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can unfollow a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/follow`, {
      method: "DELETE",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ following: false });
  });
});
