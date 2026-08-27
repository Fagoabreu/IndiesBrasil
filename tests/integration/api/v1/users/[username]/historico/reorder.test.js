import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import profile from "models/profile";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("PATCH /api/v1/users/[username]/historico/reorder", () => {
  let owner;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoReorder",
      email: "dono.reorder@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroReorder",
      email: "outro.reorder@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456702,
    });
    otherToken = otherCtx.sessionToken;
  });

  async function createHistorico(ordem, company) {
    await profile.saveHistorico({
      user_id: owner.id,
      ordem,
      company,
      cargo: "Cargo",
      init_date: "2019-01-01",
      end_date: null,
      cidade: "São Paulo",
      estado: "SP",
      atribuicoes: null,
    });
  }

  test("Anonymous user cannot reorder", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico/reorder`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ historicos: [] }),
    });
    expect(response.status).toBe(403);
  });

  test("Another user cannot reorder", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico/reorder`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ historicos: [] }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can reorder historico entries", async () => {
    await createHistorico(1, "Empresa A");
    await createHistorico(2, "Empresa B");

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`);
    const listBody = await listResponse.json();
    expect(listBody).toHaveLength(2);

    const [first, second] = listBody;

    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico/reorder`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        historicos: [
          { id: first.id, ordem: 2 },
          { id: second.id, ordem: 1 },
        ],
      }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(2);

    const updatedListResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/historico`);
    const updatedList = await updatedListResponse.json();
    const byCompany = (company) => updatedList.find((item) => item.company === company);
    expect(byCompany("Empresa A").ordem).toBe(2);
    expect(byCompany("Empresa B").ordem).toBe(1);
  });
});
