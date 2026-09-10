const { default: orchestrator } = require("tests/orchestrator");
import webserver from "@/infra/webserver";
import database from "infra/database";
import user from "models/user";

const PAGE_SIZE = 20;
const SEEDED_USERS = 25;
const BASE_DATE = new Date("2025-01-01T00:00:00.000Z").getTime();

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

// `created_at` explícito e distinto por usuário: a listagem é ordenada por
// `created_at DESC, id DESC` e, sem isso, inserções consecutivas poderiam
// empatar em microssegundos e deixar a ordem indefinida.
async function createUserWithCreatedAt(username, createdAt, resumo) {
  const createdUser = await orchestrator.createUser({
    username,
    resumo: resumo || `Resumo de ${username}`,
  });

  await database.query({
    text: `
      UPDATE users
      SET created_at = $1
      WHERE id = $2;
    `,
    values: [createdAt, createdUser.id],
  });

  return createdUser;
}

async function seedUsers(prefix, count) {
  const createdUsers = [];

  for (let index = 0; index < count; index++) {
    const createdAt = new Date(BASE_DATE + index * 60_000).toISOString();
    createdUsers.push(await createUserWithCreatedAt(`${prefix}${String(index).padStart(2, "0")}`, createdAt));
  }

  return createdUsers;
}

async function getUsers(query = "", cookie) {
  const response = await fetch(`${webserver.origin}/api/v1/users${query}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });

  return { response, body: await response.json() };
}

describe("GET /api/v1/users", () => {
  describe("Anonymous user", () => {
    describe("Pagination", () => {
      let seededUsers;

      beforeAll(async () => {
        await orchestrator.clearDatabase();
        await orchestrator.runPendingMigrations();
        seededUsers = await seedUsers("pagina", SEEDED_USERS);
      });

      test("Returns the first page wrapped in a pagination envelope", async () => {
        const { response, body } = await getUsers(`?limit=${PAGE_SIZE}`);

        expect(response.status).toBe(200);
        expect(Object.keys(body).sort()).toEqual(["has_more", "items", "next_cursor", "total"]);
        expect(body.items).toHaveLength(PAGE_SIZE);
        expect(body.total).toBe(SEEDED_USERS);
        expect(body.has_more).toBe(true);
        expect(typeof body.next_cursor).toBe("string");
      });

      test("Does not leak sensitive fields nor the cursor helper column", async () => {
        const { body } = await getUsers("?limit=1");
        const [firstUser] = body.items;

        expect(firstUser).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            username: expect.any(String),
            created_at: expect.any(String),
            is_following: false,
          }),
        );
        expect(firstUser).not.toHaveProperty("email");
        expect(firstUser).not.toHaveProperty("cpf");
        expect(firstUser).not.toHaveProperty("password");
        expect(firstUser).not.toHaveProperty("features");
        expect(firstUser).not.toHaveProperty("created_at_cursor");
      });

      test("Returns the most recent users first", async () => {
        const { body } = await getUsers(`?limit=${PAGE_SIZE}`);
        const expected = seededUsers
          .map((seededUser) => seededUser.username)
          .reverse()
          .slice(0, PAGE_SIZE);

        expect(body.items.map((item) => item.username)).toEqual(expected);
      });

      test("Paginates through every user exactly once", async () => {
        const collectedIds = [];
        let cursor = null;

        for (let page = 0; page < 10; page++) {
          const query = cursor ? `?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}` : `?limit=${PAGE_SIZE}`;

          const { body } = await getUsers(query);

          collectedIds.push(...body.items.map((item) => item.id));
          cursor = body.next_cursor;

          if (!body.has_more) break;
        }

        expect(collectedIds).toHaveLength(SEEDED_USERS);
        expect(new Set(collectedIds).size).toBe(SEEDED_USERS);
        expect([...collectedIds].sort()).toEqual(seededUsers.map((seededUser) => seededUser.id).sort());
      });

      test("Last page has `has_more: false` and no `next_cursor`", async () => {
        const { body: firstPage } = await getUsers(`?limit=${PAGE_SIZE}`);
        const { body: lastPage } = await getUsers(`?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(firstPage.next_cursor)}`);

        expect(lastPage.items).toHaveLength(SEEDED_USERS - PAGE_SIZE);
        expect(lastPage.has_more).toBe(false);
        expect(lastPage.next_cursor).toBeNull();
        expect(lastPage.total).toBe(SEEDED_USERS);
      });

      test("Ignores an invalid `cursor` instead of failing", async () => {
        const { response, body } = await getUsers("?cursor=not-a-cursor");

        expect(response.status).toBe(200);
        expect(body.items).toHaveLength(PAGE_SIZE);
      });

      test("Respects `limit` and clamps it to 50", async () => {
        const { body: smallPage } = await getUsers("?limit=5");
        expect(smallPage.items).toHaveLength(5);
        expect(smallPage.has_more).toBe(true);

        const { body: hugePage } = await getUsers("?limit=500");
        expect(hugePage.items).toHaveLength(SEEDED_USERS);
        expect(hugePage.has_more).toBe(false);
      });

      test("Falls back to the default page size for a non numeric `limit`", async () => {
        const { body } = await getUsers("?limit=abc");
        expect(body.items).toHaveLength(PAGE_SIZE);
      });
    });

    describe("Search", () => {
      beforeAll(async () => {
        await orchestrator.clearDatabase();
        await orchestrator.runPendingMigrations();

        await orchestrator.createUser({ username: "ana-pixel", resumo: "Artista 3D" });
        await orchestrator.createUser({ username: "bruno-code", resumo: "Programador de gameplay" });
        await orchestrator.createUser({ username: "carla-sound", resumo: "Compositora" });
      });

      test("Filters by `username`", async () => {
        const { body } = await getUsers("?q=bruno");

        expect(body.total).toBe(1);
        expect(body.items.map((item) => item.username)).toEqual(["bruno-code"]);
      });

      test("Filters by `resumo`", async () => {
        const { body } = await getUsers("?q=compositora");

        expect(body.total).toBe(1);
        expect(body.items.map((item) => item.username)).toEqual(["carla-sound"]);
      });

      test("Is case-insensitive and matches partial terms", async () => {
        const { body } = await getUsers("?q=PIXEL");

        expect(body.items.map((item) => item.username)).toEqual(["ana-pixel"]);
      });

      test("Treats `%` and `_` as literal characters", async () => {
        const { body: percentSearch } = await getUsers(`?q=${encodeURIComponent("%")}`);
        expect(percentSearch.total).toBe(0);
        expect(percentSearch.items).toEqual([]);

        const { body: underscoreSearch } = await getUsers(`?q=${encodeURIComponent("_")}`);
        expect(underscoreSearch.total).toBe(0);
        expect(underscoreSearch.items).toEqual([]);
      });

      test("Returns an empty page when nothing matches", async () => {
        const { response, body } = await getUsers("?q=termo-que-nao-existe");

        expect(response.status).toBe(200);
        expect(body.total).toBe(0);
        expect(body.has_more).toBe(false);
        expect(body.next_cursor).toBeNull();
        expect(body.items).toEqual([]);
      });
    });

    describe("isfollowing filter without a session", () => {
      beforeAll(async () => {
        await orchestrator.clearDatabase();
        await orchestrator.runPendingMigrations();

        await orchestrator.createUser({ username: "anonimo-alvo-1" });
        await orchestrator.createUser({ username: "anonimo-alvo-2" });
      });

      test("`isfollowing=true` matches nobody and `is_following` is false", async () => {
        const { response, body } = await getUsers("?isfollowing=true");

        expect(response.status).toBe(200);
        expect(body.total).toBe(0);
        expect(body.items).toEqual([]);

        const { body: unfiltered } = await getUsers("?isfollowing=false");
        expect(unfiltered.items).toHaveLength(2);
        expect(unfiltered.items.every((item) => item.is_following === false)).toBe(true);
      });
    });
  });

  describe("Default user", () => {
    describe("isfollowing filter", () => {
      let loggedUser;
      let followedUser;
      let notFollowedUser;
      let cookie;

      beforeAll(async () => {
        await orchestrator.clearDatabase();
        await orchestrator.runPendingMigrations();

        loggedUser = await orchestrator.activateUser(await orchestrator.createUser({ username: "usuario-logado" }));
        followedUser = await orchestrator.activateUser(await orchestrator.createUser({ username: "usuario-seguido" }));
        notFollowedUser = await orchestrator.createUser({ username: "usuario-nao-seguido" });

        const sessionObject = await orchestrator.createSession(loggedUser);
        cookie = `session_id=${sessionObject.token}`;

        await user.addFollow(loggedUser.id, followedUser.id);
      });

      test("Exposes `is_following` for the logged user", async () => {
        const { response, body } = await getUsers("?limit=50", cookie);

        expect(response.status).toBe(200);
        expect(body.items.map((item) => item.username)).not.toContain(loggedUser.username);
        expect(body.items.find((item) => item.username === followedUser.username).is_following).toBe(true);
        expect(body.items.find((item) => item.username === notFollowedUser.username).is_following).toBe(false);
      });

      test("`isfollowing=true` returns only followed users", async () => {
        const { body } = await getUsers("?isfollowing=true", cookie);

        expect(body.total).toBe(1);
        expect(body.items.map((item) => item.username)).toEqual([followedUser.username]);
        expect(body.items[0].is_following).toBe(true);
      });

      test("`isfollowing=false` excludes the followed users", async () => {
        const { body } = await getUsers("?isfollowing=false&limit=50", cookie);
        const usernames = body.items.map((item) => item.username);

        expect(usernames).toContain(notFollowedUser.username);
        expect(usernames).not.toContain(followedUser.username);
        expect(usernames).not.toContain(loggedUser.username);
      });

      test("Combines the search term with the following filter", async () => {
        const { body: match } = await getUsers("?isfollowing=true&q=seguido", cookie);
        expect(match.items.map((item) => item.username)).toEqual([followedUser.username]);

        const { body: noMatch } = await getUsers("?isfollowing=true&q=nao-seguido", cookie);
        expect(noMatch.total).toBe(0);
        expect(noMatch.items).toEqual([]);
      });
    });
  });
});
