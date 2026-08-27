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

describe("GET/POST /api/v1/studios", () => {
  let owner;
  let ownerToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoEstudio",
      email: "dono.estudio@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;
  });

  test("Anonymous user can list studios", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Anonymous user cannot create a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Estúdio Anônimo" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can create a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Estúdio Teste" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.name).toBe("Estúdio Teste");
    expect(body.owner_id).toBe(owner.id);
    expect(body.slug).toBeTruthy();
  });

  test("Owner cannot create a second studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Segundo Estúdio" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("List includes the created studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Estúdio Teste");
    expect(body[0].owner_username).toBe(owner.username);
  });
});
