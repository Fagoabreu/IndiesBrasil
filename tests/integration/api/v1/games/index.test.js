import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/games", () => {
  let owner;
  let ownerToken;
  let studio;
  let createdGame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoJogoLista",
      email: "dono.jogo.lista@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456801,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Jogo Lista" });
    createdGame = await game.create(studio.id, owner.id, {
      name: "Jogo da Lista",
      short_description: "Descrição curta do jogo",
      genre: "Ação",
      stage: "concept",
    });
  });

  test("Anonymous user can list games", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo da Lista");
    expect(body[0].slug).toBe(createdGame.slug);
  });

  test("Search filter returns matching games", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games?search=Lista`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo da Lista");
  });

  test("Search filter with no match returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games?search=Inexistente`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Anonymous isfollowing falls back to full list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games?isfollowing=true`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo da Lista");
  });

  test("Activated user can list followed games", async () => {
    await game.followGame(createdGame.id, owner.id);

    const response = await fetch(`${webserver.origin}/api/v1/games?isfollowing=true`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo da Lista");
  });
});
