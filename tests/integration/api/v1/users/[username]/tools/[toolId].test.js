import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import tool from "models/tool";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("PATCH/DELETE /api/v1/users/[username]/tools/[toolId]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let toolId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoTool",
      email: "dono.tool@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroTool",
      email: "outro.tool@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456702,
    });
    otherToken = otherCtx.sessionToken;

    const createdTool = await tool.createTool({ name: "Unity", icon_img: "x" });
    toolId = createdTool.id;

    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ portfolio_tool_id: toolId, experience: "Pleno" }),
    });
    if (postResponse.status !== 200) {
      throw new Error(`Setup falhou com status ${postResponse.status}`);
    }
  });

  test("Another user cannot patch a tool", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools/${toolId}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ experience: "Senior" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can patch a tool", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools/${toolId}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ experience: "Senior" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ portfolio_tool_id: toolId, experience: "Senior" });
  });

  test("Owner can delete a tool", async () => {
    const deleteResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools/${toolId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(deleteResponse.status).toBe(200);

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools`);
    expect(await listResponse.json()).toEqual([]);
  });
});
