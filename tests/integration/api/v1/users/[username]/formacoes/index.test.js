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

describe("GET/POST /api/v1/users/[username]/formacoes", () => {
  let owner;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoFormacoes",
      email: "dono.formacoes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 52123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroFormacoes",
      email: "outro.formacoes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 52123456702,
    });
    otherToken = otherCtx.sessionToken;
  });

  test("Anonymous user can read formacoes", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Another user cannot create formacoes", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({
        ordem: 1,
        nome: "Ciência da Computação",
        init_date: "2015-01-01",
        end_date: "2019-12-01",
        instituicao: "USP",
      }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a formacao and read it back", async () => {
    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        ordem: 1,
        nome: "Ciência da Computação",
        init_date: "2015-01-01",
        end_date: "2019-12-01",
        instituicao: "USP",
      }),
    });
    expect(postResponse.status).toBe(200);

    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes`);
    const body = await getResponse.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      ordem: 1,
      nome: "Ciência da Computação",
      instituicao: "USP",
    });
  });
});
