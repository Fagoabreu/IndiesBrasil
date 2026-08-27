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

describe("GET/POST /api/v1/users/[username]/historico", () => {
  let owner;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoHistorico",
      email: "dono.historico@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 54123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroHistorico",
      email: "outro.historico@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 54123456702,
    });
    otherToken = otherCtx.sessionToken;
  });

  test("Anonymous user can read historico", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Another user cannot create historico", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({
        ordem: 1,
        company: "Empresa X",
        cargo: "Desenvolvedor",
        init_date: "2019-01-01",
        end_date: "2021-01-01",
        cidade: "São Paulo",
        estado: "SP",
        atribuicoes: ["Desenvolvimento de sistemas"],
      }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create historico and read it back", async () => {
    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        ordem: 1,
        company: "Empresa X",
        cargo: "Desenvolvedor",
        init_date: "2019-01-01",
        end_date: "2021-01-01",
        cidade: "São Paulo",
        estado: "SP",
        atribuicoes: ["Desenvolvimento de sistemas"],
      }),
    });
    expect(postResponse.status).toBe(200);

    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`);
    const body = await getResponse.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      ordem: 1,
      company: "Empresa X",
      cargo: "Desenvolvedor",
      cidade: "São Paulo",
      estado: "SP",
    });
  });
});
