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

describe("GET/POST /api/v1/users/[username]/roles", () => {
  let owner;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoRoles",
      email: "dono.roles@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 57123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroRoles",
      email: "outro.roles@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 57123456702,
    });
    otherToken = otherCtx.sessionToken;
  });

  test("Anonymous user can read roles", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Another user cannot create roles", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Compositor", experience: "Pleno", ordem: 1 }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a role and read it back", async () => {
    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Compositor", experience: "Pleno", ordem: 1 }),
    });
    expect(postResponse.status).toBe(200);

    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles`);
    const body = await getResponse.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      portfolio_role_name: "Compositor",
      experience: "Pleno",
      ordem: 1,
    });
  });
});
