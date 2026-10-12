const { default: orchestrator } = require("tests/orchestrator");
import session from "models/session";
import { version as uuidVersion } from "uuid";
import setCookieParser from "set-cookie-parser";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import webserver from "@/infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("Post /api/v1/sessions", () => {
  describe("Anonymous user", () => {
    test("With correct `email` but incorrect `password`", async () => {
      await orchestrator.createUser({
        password: TEST_CREDENTIALS.correctLogin,
      });

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email.errado@gmail.com",
          password: TEST_CREDENTIALS.correctLogin,
        }),
      });

      expect(response.status).toBe(401);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Dados de autenticação não conferem.",
        action: "Verifique se os dados enviados estão corretos",
        status_code: 401,
      });
    });

    test("With incorrect `email` but correct `password`", async () => {
      await orchestrator.createUser({
        email: "email.correto@gmail.com",
      });

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email.correto@gmail.com",
          password: TEST_CREDENTIALS.wrongLogin,
        }),
      });

      expect(response.status).toBe(401);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Dados de autenticação não conferem.",
        action: "Verifique se os dados enviados estão corretos",
        status_code: 401,
      });
    });

    test("With incorrect `email` and incorrect `password`", async () => {
      await orchestrator.createUser();

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email.errado@gmail.com",
          password: TEST_CREDENTIALS.wrongLogin,
        }),
      });

      expect(response.status).toBe(401);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Dados de autenticação não conferem.",
        action: "Verifique se os dados enviados estão corretos",
        status_code: 401,
      });
    });

    test("With correct `email` and correct `password`", async () => {
      const createdUser = await orchestrator.createUser({
        email: "tudo.correto@gmail.com",
        password: TEST_CREDENTIALS.allCorrect,
      });
      await orchestrator.activateUser(createdUser);

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "tudo.correto@gmail.com",
          password: TEST_CREDENTIALS.allCorrect,
        }),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        user_id: createdUser.id,
        expires_at: responseBody.expires_at,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      // O token de sessão NÃO é exposto no corpo: com isso ele fica acessível
      // apenas via cookie httpOnly, fora do alcance de JavaScript.
      expect(responseBody).not.toHaveProperty("token");

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(Date.parse(responseBody.expires_at)).not.toBeNaN();
      const expiresAt = new Date(responseBody.expires_at);
      const createdAt = new Date(responseBody.created_at);

      expect(expiresAt >= createdAt).toBe(true);

      const actualLifetimeInMilliseconds = expiresAt - createdAt;
      const lifetimeDifferenceInMilliseconds = session.EXPIRATION_IN_MILLISECONDS - actualLifetimeInMilliseconds;
      expect(lifetimeDifferenceInMilliseconds).toBeLessThanOrEqual(5000);

      const parsedSetCookie = setCookieParser(response, {
        map: true,
      });

      // O token continua trafegando pelo cookie httpOnly.
      expect(parsedSetCookie.session_id.value).toMatch(/^[0-9a-f]{96}$/);
      expect(parsedSetCookie.session_id).toEqual({
        name: "session_id",
        value: parsedSetCookie.session_id.value,
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      });
    });

    test("O banco guarda o hash do token, não o token", async () => {
      // Antes o token era gravado literalmente em `sessions.token`: quem
      // obtivesse um dump do banco tinha sessões prontas para usar, e o bcrypt da
      // senha não protegia nada disso — a sessão já está autenticada.
      const createdUser = await orchestrator.createUser({
        email: "hash.na.sessao@gmail.com",
        password: TEST_CREDENTIALS.allCorrect,
      });
      await orchestrator.activateUser(createdUser);

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "hash.na.sessao@gmail.com", password: TEST_CREDENTIALS.allCorrect }),
      });
      expect(response.status).toBe(201);

      const tokenNoCookie = setCookieParser(response, { map: true }).session_id.value;
      const database = (await import("infra/database.js")).default;

      const linhas = await database.query({
        text: `select token from sessions where user_id = $1`,
        values: [createdUser.id],
      });

      expect(linhas.rowCount).toBe(1);
      // O valor no banco é o SHA-256 (64 hex) do que está no cookie — nunca o
      // próprio token (96 hex).
      expect(linhas.rows[0].token).toMatch(/^[0-9a-f]{64}$/);
      expect(linhas.rows[0].token).not.toBe(tokenNoCookie);

      // E o token do cookie continua autenticando (a busca passa pelo hash).
      const userResponse = await fetch(`${webserver.origin}/api/v1/user`, {
        headers: { cookie: `session_id=${tokenNoCookie}` },
      });
      expect(userResponse.status).toBe(200);
    });

    test("Sessão legada em texto plano é aceita e convertida no primeiro uso", async () => {
      // Compatibilidade: subir o hash não pode deslogar quem já está logado. Uma
      // sessão gravada no formato antigo continua valendo e é migrada na hora.
      const createdUser = await orchestrator.createUser({
        email: "sessao.legada@gmail.com",
        password: TEST_CREDENTIALS.allCorrect,
      });
      await orchestrator.activateUser(createdUser);

      const database = (await import("infra/database.js")).default;
      const tokenLegado = "a".repeat(96);

      const inserida = await database.query({
        text: `
          insert into sessions (token, user_id, expires_at)
          values ($1, $2, now() + interval '1 day')
          returning id
        `,
        values: [tokenLegado, createdUser.id],
      });
      const sessionId = inserida.rows[0].id;

      const userResponse = await fetch(`${webserver.origin}/api/v1/user`, {
        headers: { cookie: `session_id=${tokenLegado}` },
      });
      expect(userResponse.status).toBe(200);
      expect(userResponse.headers.get("set-cookie")).toContain(tokenLegado);

      // Depois do uso, a linha já está no formato novo.
      const depois = await database.query({
        text: `select token from sessions where id = $1`,
        values: [sessionId],
      });
      expect(depois.rows[0].token).toMatch(/^[0-9a-f]{64}$/);
      expect(depois.rows[0].token).not.toBe(tokenLegado);
    });
  });
});
