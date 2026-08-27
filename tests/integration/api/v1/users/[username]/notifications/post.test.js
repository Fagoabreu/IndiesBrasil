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

describe("GET/PATCH /api/v1/users/[username]/notifications/post", () => {
  let owner;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoNotifPost",
      email: "dono.notifpost@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 62123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroNotifPost",
      email: "outro.notifpost@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 62123456702,
    });
    otherToken = otherCtx.sessionToken;
  });

  test("Anonymous user cannot read post notifications", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications/post`);
    expect(response.status).toBe(403);
  });

  test("Another user cannot read post notifications", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications/post`, {
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can read their own (empty) post notifications", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications/post`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
