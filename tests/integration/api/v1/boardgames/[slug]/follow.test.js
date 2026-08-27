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

describe("POST/DELETE /api/v1/boardgames/[slug]/follow", () => {
  let followerToken;
  let studio;
  let createdBoardgame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBoardFollow",
      email: "dono.board.follow@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456824,
    });

    const followerCtx = await createActivatedUserWithSession({
      username: "SeguidorBoard",
      email: "seguidor.board@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456825,
    });
    followerToken = followerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Board Follow" });
    createdBoardgame = await boardgame.create(ownerCtx.user.id, studio.id, {
      name: "Board Seguido",
    });
  });

  test("Anonymous user cannot follow a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/follow`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can follow a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ following: true });
  });

  test("Detail reflects following state after follow", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`, {
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer.isFollowing).toBe(true);
  });

  test("Anonymous user cannot unfollow a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/follow`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can unfollow a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}/follow`, {
      method: "DELETE",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ following: false });
  });
});
