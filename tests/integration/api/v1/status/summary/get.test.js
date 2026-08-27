import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/status/summary", () => {
  test("Anonymous user gets the summary", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/status/summary`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("user_accounts");
    expect(body).toHaveProperty("new_user_accounts");
    expect(body).toHaveProperty("new_posts");
    expect(body).toHaveProperty("previous_posts");
    expect(body).toHaveProperty("events");
    expect(body).toHaveProperty("previous_events");
    expect(body).toHaveProperty("organizations");
    expect(body).toHaveProperty("new_organizations");
  });

  test("Summary counts activated users", async () => {
    await createActivatedUserWithSession({
      username: "ResumoUsuario",
      email: "resumo.usuario@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456706,
    });

    const response = await fetch(`${webserver.origin}/api/v1/status/summary`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Number(body.user_accounts)).toBe(1);
  });
});
