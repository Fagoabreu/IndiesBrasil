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

describe("GET /api/v1/contact-types", () => {
  test("Anonymous user cannot list contact types", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/contact-types`);
    expect(response.status).toBe(403);
  });

  test("Activated user can list the seeded contact types", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ContatoTipoLeitor",
      email: "contato.tipo.leitor@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456710,
    });

    const response = await fetch(`${webserver.origin}/api/v1/contact-types`, {
      headers: authHeaders(ctx.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(14);
    expect(body.some((type) => type.icon_key === "Discord")).toBe(true);
  });
});

describe("POST /api/v1/contact-types", () => {
  test("Anonymous user cannot create a contact type", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/contact-types`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ icon_key: "Pix", icon_img: "pix" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user without read:admin cannot create a contact type", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ContatoTipoComum",
      email: "contato.tipo.comum@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456711,
    });

    const response = await fetch(`${webserver.origin}/api/v1/contact-types`, {
      method: "POST",
      headers: { ...authHeaders(ctx.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ icon_key: "Pix", icon_img: "pix" }),
    });
    expect(response.status).toBe(403);
  });

  test("Admin can create a contact type", async () => {
    const admin = await createAdminUser({
      username: "ContatoTipoAdmin",
      email: "contato.tipo.admin@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456712,
    });

    const response = await fetch(`${webserver.origin}/api/v1/contact-types`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ icon_key: "Pix", icon_img: "pix" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.icon_key).toBe("Pix");
    expect(body.icon_img).toBe("pix");
    expect(body.id).toBeDefined();
  });
});
