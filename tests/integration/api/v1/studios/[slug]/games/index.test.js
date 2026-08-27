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

describe("GET/POST /api/v1/studios/[slug]/games", () => {
  let ownerToken;
  let otherToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoStudioGames",
      email: "dono.studio.games@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456841,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroStudioGames",
      email: "outro.studio.games@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456842,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Studio Games" });
  });

  test("Anonymous user can list studio games", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/games`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/games`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jogo Anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot create a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/games`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Jogo de Outro" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/games`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Jogo do Estúdio", short_description: "Descrição" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.name).toBe("Jogo do Estúdio");
    expect(body.slug).toBeTruthy();
  });

  test("Owner cannot create a game without name", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/games`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Studio games list includes the created game", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/games`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo do Estúdio");
  });
});
