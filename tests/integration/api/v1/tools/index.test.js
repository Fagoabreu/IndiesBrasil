import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/tools", () => {
  test("Anonymous user cannot list tools", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/tools`);
    expect(response.status).toBe(403);
  });

  test("Activated user can list the seeded tools", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "FerramentaLeitor",
      email: "ferramenta.leitor@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456701,
    });

    const response = await fetch(`${webserver.origin}/api/v1/tools`, {
      headers: authHeaders(ctx.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(7);
    expect(body.some((tool) => tool.name === "Godot")).toBe(true);
  });
});

describe("POST /api/v1/tools", () => {
  test("Anonymous user cannot create a tool", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/tools`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Figma", icon_img: "figma" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user without read:admin cannot create a tool", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "FerramentaComum",
      email: "ferramenta.comum@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456702,
    });

    const response = await fetch(`${webserver.origin}/api/v1/tools`, {
      method: "POST",
      headers: { ...authHeaders(ctx.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Figma", icon_img: "figma" }),
    });
    expect(response.status).toBe(403);
  });

  test("Admin can create a tool", async () => {
    const admin = await createAdminUser({
      username: "FerramentaAdmin",
      email: "ferramenta.admin@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456703,
    });

    const response = await fetch(`${webserver.origin}/api/v1/tools`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Figma", icon_img: "figma" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Figma");
    expect(body.icon_img).toBe("figma");
    expect(body.id).toBeDefined();
  });
});
