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

describe("GET/POST /api/v1/users/[username]/tools", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let toolId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoTools",
      email: "dono.tools@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 59123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroTools",
      email: "outro.tools@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 59123456702,
    });
    otherToken = otherCtx.sessionToken;

    const createdTool = await tool.createTool({ name: "Unity", icon_img: "https://icons.dev/unity.png" });
    toolId = createdTool.id;
  });

  test("Anonymous user can read tools", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Another user cannot create tools", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ portfolio_tool_id: toolId, experience: "Pleno" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a tool and read it back", async () => {
    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ portfolio_tool_id: toolId, experience: "Pleno" }),
    });
    expect(postResponse.status).toBe(200);

    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/tools`);
    const body = await getResponse.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      portfolio_tool_id: toolId,
      experience: "Pleno",
      name: "Unity",
    });
  });
});
