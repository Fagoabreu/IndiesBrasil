import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("POST /api/v1/streams/refresh", () => {
  test("Anonymous user cannot trigger a refresh", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/streams/refresh`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user without read:admin cannot trigger a refresh", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "UsuarioComumRefresh",
      email: "usuario.comum.refresh@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456702,
    });

    const response = await fetch(`${webserver.origin}/api/v1/streams/refresh`, {
      method: "POST",
      headers: { cookie: `session_id=${ctx.sessionToken}` },
    });
    expect(response.status).toBe(403);
  });

  test("Admin can trigger a refresh (no channels registered)", async () => {
    const admin = await createAdminUser({
      username: "AdminRefresh",
      email: "admin.refresh@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456703,
    });

    const response = await fetch(`${webserver.origin}/api/v1/streams/refresh`, {
      method: "POST",
      headers: { cookie: `session_id=${admin.sessionToken}` },
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ ok: true, checked: 0 });
  });
});
