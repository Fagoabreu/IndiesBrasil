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

describe("GET /api/v1/users/[username]/posts", () => {
  let owner;
  let ownerToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoPosts",
      email: "dono.posts@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 63123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;
  });

  test("Anonymous user can read a user's posts (empty)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/posts`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Authenticated user can read a user's posts (empty)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/posts`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
