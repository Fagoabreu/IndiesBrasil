import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("POST/DELETE /api/v1/users/[username]/follow", () => {
  let follower;
  let followerToken;
  let leader;

  beforeAll(async () => {
    const followerCtx = await createActivatedUserWithSession({
      username: "Seguidor",
      email: "seguidor@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 49123456701,
    });
    follower = followerCtx.user;
    followerToken = followerCtx.sessionToken;

    const leaderCtx = await createActivatedUserWithSession({
      username: "Lider",
      email: "lider@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 49123456702,
    });
    leader = leaderCtx.user;
  });

  test("Anonymous user cannot follow", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${leader.username}/follow`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
  });

  test("User cannot follow themselves", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${follower.username}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
    expect(body.message).toBe("O usuário não pode seguir a si mesmo");
  });

  test("User can follow another user", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${leader.username}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.action).toBe("followed");
    expect(body.followed).toBe(true);
  });

  test("Following again reports already_following", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${leader.username}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.action).toBe("already_following");
  });

  test("User can unfollow", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${leader.username}/follow`, {
      method: "DELETE",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.action).toBe("unfollowed");
    expect(body.followed).toBe(false);
  });
});
