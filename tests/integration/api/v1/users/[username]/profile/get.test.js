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

describe("GET /api/v1/users/[username]/profile", () => {
  let owner;

  beforeAll(async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfileOwner",
      email: "profile.owner@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 48123456701,
    });
    owner = ctx.user;
  });

  test("Anonymous user can read a public profile", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/profile`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toMatchObject({ username: "ProfileOwner" });
    expect(Array.isArray(body.historico)).toBe(true);
    expect(Array.isArray(body.formacoes)).toBe(true);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(Array.isArray(body.contacts)).toBe(true);
    expect(Array.isArray(body.roles)).toBe(true);
  });

  test("Unknown username returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/UsuarioInexistente/profile`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      name: "NotFoundError",
      message: "O username informado não foi encontrado no sistema.",
      action: "Verifique se o username foi digitado corretamente",
      status_code: 404,
    });
  });
});
