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

describe("PATCH/DELETE /api/v1/users/[username]/historico/[historicoId]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let historicoId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoHist",
      email: "dono.hist@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroHist",
      email: "outro.hist@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456702,
    });
    otherToken = otherCtx.sessionToken;

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
        atribuicoes: ["Desenvolvimento"],
      }),
    });
    if (postResponse.status !== 200) {
      throw new Error(`Setup falhou com status ${postResponse.status}`);
    }

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`);
    const listBody = await listResponse.json();
    historicoId = listBody[0].id;
  });

  test("Another user cannot patch historico", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico/${historicoId}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ cargo: "Sênior" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can patch historico", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico/${historicoId}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ cargo: "Desenvolvedor Sênior" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ cargo: "Desenvolvedor Sênior" });
  });

  test("Owner can delete historico", async () => {
    const deleteResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico/${historicoId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(deleteResponse.status).toBe(200);

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`);
    expect(await listResponse.json()).toEqual([]);
  });
});
