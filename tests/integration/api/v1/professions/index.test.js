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

describe("GET /api/v1/professions", () => {
  test("Anonymous user cannot list professions", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/professions`);
    expect(response.status).toBe(403);
  });

  test("Activated user can list the seeded professions", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoLeitor",
      email: "profissao.leitor@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456707,
    });

    const response = await fetch(`${webserver.origin}/api/v1/professions`, {
      headers: authHeaders(ctx.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((role) => role.name === "Designer de Jogos")).toBe(true);
    expect(body.every((role) => "name" in role && "icon_img" in role)).toBe(true);
  });
});

describe("POST /api/v1/professions", () => {
  test("Anonymous user cannot create a profession", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/professions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jornalista", icon_img: "jornalista" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user without read:admin cannot create a profession", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoComum",
      email: "profissao.comum@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456708,
    });

    const response = await fetch(`${webserver.origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(ctx.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Jornalista", icon_img: "jornalista" }),
    });
    expect(response.status).toBe(403);
  });

  // A coluna `portfolio_roles.name` é um enum `developer_role`, e a migration
  // de seeds já insere TODOS os valores válidos do enum. Logo, qualquer POST
  // colide com a primary key (name) e a `database.query` converte o erro em
  // ServiceError (503); porém o `onErrorHandler` não trata ServiceError, então
  // o erro sobe como InternalServerError (500). Documentamos o comportamento
  // atual: o endpoint não consegue criar novas profissões.
  test("Admin POST fails because the enum is exhausted (500)", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoAdmin",
      email: "profissao.admin@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456709,
    });

    const response = await fetch(`${webserver.origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Jornalista", icon_img: "jornalista" }),
    });
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.name).toBe("InternalServerError");
  });
});
