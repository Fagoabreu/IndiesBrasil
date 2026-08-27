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

describe("PATCH/DELETE /api/v1/users/[username]/formacoes/[formacaoId]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let formacaoId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoFormacao",
      email: "dono.formacao@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 53123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroFormacao",
      email: "outro.formacao@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 53123456702,
    });
    otherToken = otherCtx.sessionToken;

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
    if (postResponse.status !== 200) {
      throw new Error(`Setup falhou com status ${postResponse.status}`);
    }

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes`);
    const listBody = await listResponse.json();
    formacaoId = listBody[0].id;
  });

  test("Another user cannot patch a formacao", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes/${formacaoId}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ nome: "Engenharia" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can patch a formacao", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes/${formacaoId}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ nome: "Engenharia de Software" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ nome: "Engenharia de Software" });
  });

  test("Owner can delete a formacao", async () => {
    const deleteResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes/${formacaoId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(deleteResponse.status).toBe(200);

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/formacoes`);
    expect(await listResponse.json()).toEqual([]);
  });
});
