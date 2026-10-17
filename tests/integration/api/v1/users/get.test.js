const { default: orchestrator } = require("tests/orchestrator");
import webserver from "@/infra/webserver";
import database from "infra/database";
import user from "models/user";
import activation from "models/activation";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createAdminUser } from "tests/helpers/testUtils";

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
//
// A conta precisa ser **ativada**: a listagem pública mostra só quem confirmou
// o e-mail (`create:session`), a mesma definição do contador da home. Criar sem
// ativar deixaria o seed invisível e o teste mediria outra coisa.
async function createUserWithCreatedAt(username, createdAt, resumo) {
  const createdUser = await orchestrator.activateUser(
    await orchestrator.createUser({
      username,
      resumo: resumo || `Resumo de ${username}`,
    }),
  );

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

describe("GET /api/v1/users — população da lista", () => {
  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();
  });

  test("Cadastro nunca ativado não aparece na lista pública", async () => {
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();

    await orchestrator.activateUser(await orchestrator.createUser({ username: "conta-ativa" }));
    const nuncaAtivada = await orchestrator.createUser({ username: "conta-nunca-ativada" });

    const { response, body } = await getUsers("?limit=50");

    expect(response.status).toBe(200);
    // O contador da home (`user_accounts`) já contava só ativados: listar o
    // cadastro abandonado fazia `/membros` mostrar mais gente que a home
    // (47 x 41 em produção) e expunha perfil de quem nunca confirmou o e-mail.
    expect(body.items.map((item) => item.username)).toEqual(["conta-ativa"]);
    expect(body.total).toBe(1);
    expect(body.items.some((item) => item.id === nuncaAtivada.id)).toBe(false);
  });

  test("`status` desconhecido é recusado em vez de cair na lista normal", async () => {
    const { response } = await getUsers("?status=inativo");

    // Sem o 400, um erro de digitação devolveria a lista pública e o operador
    // acharia que está vendo as contas travadas.
    expect(response.status).toBe(400);
  });

  test("`status=inactive` é restrito a administradores", async () => {
    const anonimo = await getUsers("?status=inactive");
    expect(anonimo.response.status).toBe(403);

    const comum = await orchestrator.activateUser(await orchestrator.createUser({ username: "comum-consulta-inativos" }));
    const session = await orchestrator.createSession(comum);
    const autenticado = await getUsers("?status=inactive", `session_id=${session.token}`);

    // A lista expõe e-mail e vencimento de token: `read:user` (estar logado)
    // não basta.
    expect(autenticado.response.status).toBe(403);
  });

  describe("Admin", () => {
    let adminCookie;
    let expirada;
    let valida;
    let semToken;

    beforeAll(async () => {
      await orchestrator.clearDatabase();
      await orchestrator.runPendingMigrations();

      const admin = await createAdminUser({
        username: "admin-lista-inativos",
        email: "admin.lista.inativos@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: 95123456701,
      });
      adminCookie = `session_id=${admin.sessionToken}`;

      await orchestrator.activateUser(
        await orchestrator.createUser({
          username: "ja-ativada",
          email: "ja.ativada@teste.dev",
          password: TEST_CREDENTIALS.userDefault,
          cpf: 95123456702,
        }),
      );

      // Conta travada: token emitido, mas vencido.
      expirada = await orchestrator.createUser({
        username: "token-vencido",
        email: "token.vencido@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: 95123456703,
      });
      const tokenVencido = await activation.create(expirada.id);
      // Envelhece a LINHA, não o relógio do processo: a validade é decidida
      // pelo `now()` do banco (ver CLAUDE.md, "janela de validade de token").
      await database.query({
        text: `UPDATE user_activation_tokens SET expires_at = now() - interval '1 hour' WHERE id = $1`,
        values: [tokenVencido.id],
      });

      // Ainda pode ativar: não pertence a esta lista.
      valida = await orchestrator.createUser({
        username: "token-valido",
        email: "token.valido@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: 95123456704,
      });
      await activation.create(valida.id);

      // Sem token nenhum: não é o caso da aba (lá existe token vencido).
      semToken = await orchestrator.createUser({
        username: "sem-token",
        email: "sem.token@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: 95123456705,
      });
      await database.query({ text: `DELETE FROM user_activation_tokens WHERE user_id = $1`, values: [semToken.id] });
    });

    test("Lista só contas nunca ativadas com token de ativação vencido", async () => {
      const { response, body } = await getUsers("?status=inactive&limit=50", adminCookie);
      const usernames = body.items.map((item) => item.username);

      expect(response.status).toBe(200);
      expect(usernames).toEqual(["token-vencido"]);
      expect(body.total).toBe(1);

      // Contas que ainda podem ativar, ou que já ativaram, ficam fora.
      expect(usernames).not.toContain(valida.username);
      expect(usernames).not.toContain("ja-ativada");
      expect(usernames).not.toContain(semToken.username);
    });

    test("Traz e-mail e vencimento do token, e nada além disso", async () => {
      const { body } = await getUsers("?status=inactive", adminCookie);
      const [item] = body.items;

      expect(item).toMatchObject({
        id: expirada.id,
        username: "token-vencido",
        email: "token.vencido@teste.dev",
        has_other_token: false,
      });
      expect(typeof item.activation_expires_at).toBe("string");
      expect(new Date(item.activation_expires_at).getTime()).toBeLessThan(Date.now());

      // Mesmo para admin, a resposta não carrega segredo nem hash.
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("cpf");
      expect(item).not.toHaveProperty("features");
    });

    test("Sinaliza conta com pedido de reset — que a limpeza automática não anula", async () => {
      // `annulAbandonedRegistrations` preserva o cadastro que tem token de
      // outra finalidade: sem este sinal, o administrador não saberia por que
      // a conta continua no banco depois de um novo cadastro com os mesmos dados.
      await activation.create(expirada.id, activation.TOKEN_PURPOSE.RESET);

      const { body } = await getUsers("?status=inactive", adminCookie);
      expect(body.items.find((item) => item.id === expirada.id).has_other_token).toBe(true);
    });

    test("A busca alcança o e-mail na lista administrativa", async () => {
      const { body } = await getUsers(`?status=inactive&q=${encodeURIComponent("token.vencido@")}`, adminCookie);

      expect(body.items.map((item) => item.username)).toEqual(["token-vencido"]);

      const { body: semResultado } = await getUsers("?status=inactive&q=ninguem", adminCookie);
      expect(semResultado.total).toBe(0);
    });

    test("A lista normal continua devolvendo o formato público", async () => {
      const { body } = await getUsers("?limit=50", adminCookie);

      // A aba inativa não pode contaminar a resposta padrão com e-mail.
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((item) => item.email === undefined)).toBe(true);
    });
  });
});

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

        await orchestrator.activateUser(await orchestrator.createUser({ username: "ana-pixel", resumo: "Artista 3D" }));
        await orchestrator.activateUser(await orchestrator.createUser({ username: "bruno-code", resumo: "Programador de gameplay" }));
        await orchestrator.activateUser(await orchestrator.createUser({ username: "carla-sound", resumo: "Compositora" }));
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

        await orchestrator.activateUser(await orchestrator.createUser({ username: "anonimo-alvo-1" }));
        await orchestrator.activateUser(await orchestrator.createUser({ username: "anonimo-alvo-2" }));
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
        notFollowedUser = await orchestrator.activateUser(await orchestrator.createUser({ username: "usuario-nao-seguido" }));

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
