const { default: orchestrator } = require("tests/orchestrator");
import session from "models/session";
import { version as uuidVersion } from "uuid";
import setCookieParser from "set-cookie-parser";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/user", () => {
  describe("Anonymous user", () => {
    test("Retrieving the endpoint", async () => {
      const response = await fetch("http://localhost:3000/api/v1/user");
      expect(response.status).toBe(403);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "read:session" para executar esta ação.',
        status_code: 403,
      });
    });
  });
  describe("Default user", () => {
    test("With valid session", async () => {
      const createdUser = await orchestrator.createUser({
        username: "UserWithValidSession",
      });
      const activatedUser = await orchestrator.activateUser(createdUser);

      const sessionObject = await orchestrator.createSession(createdUser.id);
      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(200);
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toBe("no-store,no-cache-max-age=0,must-revalidate");

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: createdUser.id,
        username: "UserWithValidSession",
        email: createdUser.email,
        //password: createdUser.password,
        cpf: createdUser.cpf,
        created_at: createdUser.created_at.toISOString(),
        updated_at: activatedUser.updated_at.toISOString(),
        features: ["create:session", "read:session", "read:post", "create:post", "read:user", "update:user"],
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      //Session renewal assertions
      const renewedSessionObject = await session.findOneValidByToken(sessionObject.token);

      expect(renewedSessionObject.expires_at > sessionObject.expires_at).toEqual(true);
      expect(renewedSessionObject.updated_at > sessionObject.updated_at).toEqual(true);

      //set cookies assertions
      const parsedSetCookie = setCookieParser(response, {
        map: true,
      });

      expect(parsedSetCookie.session_id).toEqual({
        name: "session_id",
        value: sessionObject.token,
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      });
    });

    test("With nomexistent session", async () => {
      const nonExistentToken = "488c8ec227ddf131fbff9ecf7450a402fc98860f0ff45063630a8782d0539d70815af89b89159c266318f5c386371e27";
      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${nonExistentToken}`,
        },
      });

      expect(response.status).toBe(401);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Usuario não possui sessão ativa.",
        action: "Verifique se o usuário está logado e tente novamente.",
        status_code: 401,
      });

      // Set-Cookie assertions
      const parsedSetCookie = setCookieParser(response, {
        map: true,
      });

      expect(parsedSetCookie.session_id).toEqual({
        name: "session_id",
        value: "invalid",
        maxAge: -1,
        path: "/",
        httpOnly: true,
      });
    });

    test("With expired session", async () => {
      jest.useFakeTimers({
        now: new Date(Date.now() - session.EXPIRATION_IN_MILLISECONDS),
      });

      const createdUser = await orchestrator.createUser({
        username: "UserWithExpiredSession",
      });
      await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();

      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(401);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Usuario não possui sessão ativa.",
        action: "Verifique se o usuário está logado e tente novamente.",
        status_code: 401,
      });

      // Set-Cookie assertions
      const parsedSetCookie = setCookieParser(response, {
        map: true,
      });

      expect(parsedSetCookie.session_id).toEqual({
        name: "session_id",
        value: "invalid",
        maxAge: -1,
        path: "/",
        httpOnly: true,
      });
    });

    test("With halfway-expired session", async () => {
      jest.useFakeTimers({
        now: new Date(Date.now() - session.EXPIRATION_IN_MILLISECONDS / 2),
      });
      const createdUser = await orchestrator.createUser({
        username: "UserWithHalfwayExpiredSession",
      });
      const updatedUser = await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();
      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: createdUser.id,
        username: "UserWithHalfwayExpiredSession",
        email: createdUser.email,
        //password: createdUser.password,
        created_at: createdUser.created_at.toISOString(),
        updated_at: updatedUser.updated_at.toISOString(),
        cpf: createdUser.cpf,
        features: ["create:session", "read:session", "read:post", "create:post", "read:user", "update:user"],
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const renewedSessionObject = await session.findOneValidByToken(sessionObject.token);
      const expiresAt = renewedSessionObject.expires_at;
      const updatedAt = renewedSessionObject.updated_at;
      expect(updatedAt > sessionObject.updated_at).toEqual(true);
      expect(expiresAt > sessionObject.expires_at).toEqual(true);
      expect(Math.abs(expiresAt - updatedAt - session.EXPIRATION_IN_MILLISECONDS)).toBeLessThanOrEqual(1000);

      const parsedCookie = setCookieParser(response, { map: true });
      expect(parsedCookie.session_id).toEqual({
        name: "session_id",
        value: renewedSessionObject.token,
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      });
    });
  });
});
