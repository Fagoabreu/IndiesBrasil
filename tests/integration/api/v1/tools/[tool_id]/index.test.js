import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import tool from "models/tool";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("DELETE /api/v1/tools/[tool_id]", () => {
  let createdToolId;

  beforeAll(async () => {
    const createdTool = await tool.createTool({ name: "Figma", icon_img: "figma" });
    createdToolId = createdTool.id;
  });

  test("Anonymous user cannot delete a tool", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/tools/${createdToolId}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user without read:admin cannot delete a tool", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "FerramentaComumDel",
      email: "ferramenta.comum.del@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456704,
    });

    const response = await fetch(`${webserver.origin}/api/v1/tools/${createdToolId}`, {
      method: "DELETE",
      headers: authHeaders(ctx.sessionToken),
    });
    expect(response.status).toBe(403);
  });

  test("Admin deleting a non-existent tool returns 500", async () => {
    const admin = await createAdminUser({
      username: "FerramentaAdminDel",
      email: "ferramenta.admin.del@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456705,
    });

    const response = await fetch(`${webserver.origin}/api/v1/tools/999999`, {
      method: "DELETE",
      headers: authHeaders(admin.sessionToken),
    });
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.name).toBe("InternalServerError");
  });

  test("Admin can delete a tool", async () => {
    const admin = await createAdminUser({
      username: "FerramentaAdminDelOk",
      email: "ferramenta.admin.del.ok@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456706,
    });

    const response = await fetch(`${webserver.origin}/api/v1/tools/${createdToolId}`, {
      method: "DELETE",
      headers: authHeaders(admin.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Figma");
    expect(body.icon_img).toBe("figma");
    expect(body.id).toBe(createdToolId);
  });
});
