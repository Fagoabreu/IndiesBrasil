import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import boardgame from "models/boardgame";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/boardgames", () => {
  let owner;
  let ownerToken;
  let studio;
  let createdBoardgame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBoardLista",
      email: "dono.board.lista@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456821,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Board Lista" });
    createdBoardgame = await boardgame.create(owner.id, studio.id, {
      name: "Jogo de Mesa da Lista",
      category: "card_game",
      stage: "prototype",
    });
  });

  test("Anonymous user can list boardgames", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo de Mesa da Lista");
    expect(body[0].slug).toBe(createdBoardgame.slug);
  });

  test("Search filter returns matching boardgames", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames?search=Mesa`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo de Mesa da Lista");
  });

  test("Category filter with no match returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames?category=party_game`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Anonymous isfollowing falls back to full list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames?isfollowing=true`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo de Mesa da Lista");
  });

  test("Activated user can list followed boardgames", async () => {
    await boardgame.followBoardgame(createdBoardgame.id, owner.id);

    const response = await fetch(`${webserver.origin}/api/v1/boardgames?isfollowing=true`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo de Mesa da Lista");
  });
});
