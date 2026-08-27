import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/POST /api/v1/studios/[slug]/boardgames", () => {
  let ownerToken;
  let otherToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoStudioBoard",
      email: "dono.studio.board@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456843,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroStudioBoard",
      email: "outro.studio.board@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456844,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Studio Board" });
  });

  test("Anonymous user can list studio boardgames", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/boardgames`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/boardgames`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Board Anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot create a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/boardgames`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Board de Outro" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/boardgames`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Board do Estúdio", category: "card_game" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.name).toBe("Board do Estúdio");
    expect(body.slug).toBeTruthy();
  });

  test("Owner cannot create a boardgame without name", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/boardgames`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Studio boardgames list includes the created boardgame", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/boardgames`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Board do Estúdio");
  });
});
