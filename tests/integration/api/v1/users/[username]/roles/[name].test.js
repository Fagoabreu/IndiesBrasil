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

describe("PATCH/DELETE /api/v1/users/[username]/roles/[name]", () => {
  let owner;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoRole",
      email: "dono.role@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 58123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroRole",
      email: "outro.role@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 58123456702,
    });
    otherToken = otherCtx.sessionToken;

    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Compositor", experience: "Pleno", ordem: 1 }),
    });
    if (postResponse.status !== 200) {
      throw new Error(`Setup falhou com status ${postResponse.status}`);
    }
  });

  test("Another user cannot patch a role", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles/Compositor`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ experience: "Senior" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can patch a role", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles/Compositor`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ experience: "Senior", ordem: 2 }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ portfolio_role_name: "Compositor", experience: "Senior", ordem: 2 });
  });

  test("Owner can delete a role", async () => {
    const deleteResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles/Compositor`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(deleteResponse.status).toBe(200);

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/roles`);
    expect(await listResponse.json()).toEqual([]);
  });
});
