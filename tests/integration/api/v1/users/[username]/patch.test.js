import password from "models/password";
import user from "models/user";
import orchestrator from "tests/orchestrator";
import { version as uuidVersion } from "uuid";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import webserver from "@/infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("Patch /api/v1/users/[username]", () => {
  let sessionToken;

  describe("authenticated user", () => {
    test("create user uthenticated", async () => {
      const createdUser = await orchestrator.createUser({
        username: "authenticatedUser",
      });
      expect(createdUser.username).toBe("authenticatedUser");
      const activatedUser = await orchestrator.activateUser(createdUser);
      expect(activatedUser.username).toBe("authenticatedUser");
      sessionToken = await orchestrator.createSession(activatedUser);
    });
  });

  describe("anonymous user", () => {
    test("With unique `username`", async () => {
      const user = await orchestrator.createUser({
        username: "anonymousUser1",
      });

      const response = await fetch(`${webserver.origin}/api/v1/users/${user.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "uniqueUser2",
        }),
      });

      expect(response.status).toBe(403);
      const responseBody = await response.json();
      console.log("DEBUG features:", JSON.stringify(responseBody.features));
      expect(responseBody).toEqual({
        action: 'Verifique se o seu usuário possui a feature "update:user" para executar esta ação.',
        message: "Você não possui permissão para executar esta ação",
        name: "ForbiddenError",
        status_code: 403,
      });
    });
  });

  describe("Default user", () => {
    test("With nonexistent `username`", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users/UsuarioInexistente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionToken.token}`,
        },
      });
      expect(response.status).toBe(404);

      const response2Body = await response.json();
      expect(response2Body).toEqual({
        name: "NotFoundError",
        message: "O username informado não foi encontrado no sistema.",
        action: "Verifique se o username foi digitado corretamente",
        status_code: 404,
      });
    });

    test("With duplicated `username`", async () => {
      await orchestrator.createUser({
        username: "user1",
      });

      const user2 = await orchestrator.createUser({
        username: "user2",
      });

      const activatedUser2 = await orchestrator.activateUser(user2);
      const sessionObject2 = await orchestrator.createSession(activatedUser2);

      const response = await fetch(`${webserver.origin}/api/v1/users/user2`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject2.token}`,
        },
        body: JSON.stringify({
          username: "user1",
        }),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O usuario informado já está sendo utilizado.",
        action: "Utilize outro username para esta operação.",
        status_code: 400,
      });
    });

    test("With `user2` targeting `user1`", async () => {
      const createdUser1 = await orchestrator.createUser({
        username: "targetingUser1",
      });
      await orchestrator.activateUser(createdUser1);

      const createdUser2 = await orchestrator.createUser({
        username: "targetingUser2",
      });

      const activatedUser2 = await orchestrator.activateUser(createdUser2);
      const sessionObject2 = await orchestrator.createSession(activatedUser2);

      const response = await fetch(`${webserver.origin}/api/v1/users/targetingUser1`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject2.token}`,
        },
        body: JSON.stringify({
          username: "ustargetingUser3",
        }),
      });

      expect(response.status).toBe(403);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        action: "Verifique se você possui a feature necessária para atualizar outro usuário",
        message: "Você não possui permissão para atualizar outro usuário.",
        name: "ForbiddenError",
        status_code: 403,
      });
    });

    test("With duplicated `email`", async () => {
      await orchestrator.createUser({
        email: "email1@gmail.com",
      });

      const createdUser2 = await orchestrator.createUser({
        email: "email2@gmail.com",
      });

      const activatedUser = await orchestrator.activateUser(createdUser2);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/users/${createdUser2.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          email: "email1@gmail.com",
        }),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O email informado já está sendo utilizado.",
        action: "Utilize outro email para esta operação.",
        status_code: 400,
      });
    });

    test("With duplicated 'CPF'", async () => {
      await orchestrator.createUser({
        cpf: 55555555555,
      });

      const user2 = await orchestrator.createUser({
        cpf: 66666666666,
      });

      const activatedUser = await orchestrator.activateUser(user2);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/users/${user2.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          cpf: 55555555555,
        }),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O cpf informado já está sendo utilizado.",
        action: "Utilize outro cpf para esta operação.",
        status_code: 400,
      });
    });

    test("With unique `username`", async () => {
      const uniqueUser = await orchestrator.createUser({
        username: "uniqueUser1",
      });

      const activatedUser = await orchestrator.activateUser(uniqueUser);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/users/uniqueUser1`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          username: "uniqueUser2",
        }),
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "uniqueUser2",
        avatar_image: responseBody.avatar_image,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        features: [
          "create:session",
          "read:session",
          "read:post",
          "create:post",
          "update:post",
          "read:user",
          "update:user",
          "read:event",
          "create:event",
          "update:event",
          "read:studio",
          "create:studio",
          "update:studio",
          "delete:studio",
          "read:studio:member",
          "create:studio:member",
          "delete:studio:member",
          "read:studio:invitation",
          "create:studio:invitation",
          "read:studio:follow",
          "create:studio:follow",
          "read:game",
          "read:game:all",
          "create:game",
          "update:game",
          "delete:game",
          "create:game:follow",
          "read:game:follow",
          "create:game:review",
          "update:game:review",
          "read:boardgame",
          "read:boardgame:all",
          "create:boardgame",
          "update:boardgame",
          "delete:boardgame",
          "create:boardgame:follow",
          "read:boardgame:follow",
          "create:boardgame:review",
          "update:boardgame:review",
          "read:book",
          "read:book:all",
          "create:book",
          "update:book",
          "delete:book",
          "create:book:review",
          "update:book:review",
          "create:book:follow",
          "read:book:follow",
          "read:course",
          "create:course",
          "update:course",
          "delete:course",
          "read:course:lesson",
          "create:course:lesson",
          "update:course:lesson",
          "delete:course:lesson",
          "create:course:rating",
          "read:course:rating",
          "create:course:progress",
          "read:course:progress",
          "read:course:comment",
          "create:course:comment",
          "update:course:comment",
          "delete:course:comment",
          "create:course:enrollment",
          "read:course:enrollment",
          "read:news",
          "read:news:all",
          "create:news",
          "update:news",
          "delete:news",
          "create:news:rating",
          "create:news:factcheck",
          "create:news:comment",
          "read:content_review",
          "read:content_review:all",
          "create:content_review",
          "update:content_review",
          "delete:content_review",
        ],
        resumo: responseBody.resumo,
        visibility: "public",
        background_image: null,
        bio: responseBody.bio,
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);
    });

    test("With unique `email`", async () => {
      const user1 = await orchestrator.createUser({
        email: "uniqueEmail1@gmail.com",
      });

      const activatedUser = await orchestrator.activateUser(user1);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/users/${user1.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          email: "uniqueEmail2@gmail.com",
        }),
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: user1.username,
        avatar_image: responseBody.avatar_image,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        features: [
          "create:session",
          "read:session",
          "read:post",
          "create:post",
          "update:post",
          "read:user",
          "update:user",
          "read:event",
          "create:event",
          "update:event",
          "read:studio",
          "create:studio",
          "update:studio",
          "delete:studio",
          "read:studio:member",
          "create:studio:member",
          "delete:studio:member",
          "read:studio:invitation",
          "create:studio:invitation",
          "read:studio:follow",
          "create:studio:follow",
          "read:game",
          "read:game:all",
          "create:game",
          "update:game",
          "delete:game",
          "create:game:follow",
          "read:game:follow",
          "create:game:review",
          "update:game:review",
          "read:boardgame",
          "read:boardgame:all",
          "create:boardgame",
          "update:boardgame",
          "delete:boardgame",
          "create:boardgame:follow",
          "read:boardgame:follow",
          "create:boardgame:review",
          "update:boardgame:review",
          "read:book",
          "read:book:all",
          "create:book",
          "update:book",
          "delete:book",
          "create:book:review",
          "update:book:review",
          "create:book:follow",
          "read:book:follow",
          "read:course",
          "create:course",
          "update:course",
          "delete:course",
          "read:course:lesson",
          "create:course:lesson",
          "update:course:lesson",
          "delete:course:lesson",
          "create:course:rating",
          "read:course:rating",
          "create:course:progress",
          "read:course:progress",
          "read:course:comment",
          "create:course:comment",
          "update:course:comment",
          "delete:course:comment",
          "create:course:enrollment",
          "read:course:enrollment",
          "read:news",
          "read:news:all",
          "create:news",
          "update:news",
          "delete:news",
          "create:news:rating",
          "create:news:factcheck",
          "create:news:comment",
          "read:content_review",
          "read:content_review:all",
          "create:content_review",
          "update:content_review",
          "delete:content_review",
        ],
        resumo: responseBody.resumo,
        visibility: "public",
        background_image: null,
        bio: responseBody.bio,
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);

      const userInDatabase = await user.findOneByUsername(user1.username);
      expect(userInDatabase.email).toBe("uniqueEmail2@gmail.com");
    });

    test("With new `password`", async () => {
      const createdUser = await orchestrator.createUser({
        password: TEST_CREDENTIALS.newOne,
      });

      const activatedUser = await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/users/${createdUser.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          password: TEST_CREDENTIALS.newTwo,
        }),
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: createdUser.username,
        //email: createdUser.email,
        //password: responseBody.password,
        //cpf: responseBody.cpf,
        avatar_image: responseBody.avatar_image,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        features: [
          "create:session",
          "read:session",
          "read:post",
          "create:post",
          "update:post",
          "read:user",
          "update:user",
          "read:event",
          "create:event",
          "update:event",
          "read:studio",
          "create:studio",
          "update:studio",
          "delete:studio",
          "read:studio:member",
          "create:studio:member",
          "delete:studio:member",
          "read:studio:invitation",
          "create:studio:invitation",
          "read:studio:follow",
          "create:studio:follow",
          "read:game",
          "read:game:all",
          "create:game",
          "update:game",
          "delete:game",
          "create:game:follow",
          "read:game:follow",
          "create:game:review",
          "update:game:review",
          "read:boardgame",
          "read:boardgame:all",
          "create:boardgame",
          "update:boardgame",
          "delete:boardgame",
          "create:boardgame:follow",
          "read:boardgame:follow",
          "create:boardgame:review",
          "update:boardgame:review",
          "read:book",
          "read:book:all",
          "create:book",
          "update:book",
          "delete:book",
          "create:book:review",
          "update:book:review",
          "create:book:follow",
          "read:book:follow",
          "read:course",
          "create:course",
          "update:course",
          "delete:course",
          "read:course:lesson",
          "create:course:lesson",
          "update:course:lesson",
          "delete:course:lesson",
          "create:course:rating",
          "read:course:rating",
          "create:course:progress",
          "read:course:progress",
          "read:course:comment",
          "create:course:comment",
          "update:course:comment",
          "delete:course:comment",
          "create:course:enrollment",
          "read:course:enrollment",
          "read:news",
          "read:news:all",
          "create:news",
          "update:news",
          "delete:news",
          "create:news:rating",
          "create:news:factcheck",
          "create:news:comment",
          "read:content_review",
          "read:content_review:all",
          "create:content_review",
          "update:content_review",
          "delete:content_review",
        ],
        resumo: responseBody.resumo,
        visibility: "public",
        background_image: null,
        bio: responseBody.bio,
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);

      const userInDatabase = await user.findOneByUsername(createdUser.username);
      const correctPasswordMatch = await password.compare(TEST_CREDENTIALS.newTwo, userInDatabase.password);
      const incorrectPasswordMatch = await password.compare(TEST_CREDENTIALS.wrongCheck, userInDatabase.password);
      expect(correctPasswordMatch).toBe(true);
      expect(incorrectPasswordMatch).toBe(false);
    });
  });

  describe("With privilegedUser", () => {
    test("With  `update:user:others` targeting `default user`", async () => {
      const privilegedUser = await orchestrator.createUser();
      const activatedPrivilegedUser = await orchestrator.activateUser(privilegedUser);
      const privilegedUserSession = await orchestrator.createSession(activatedPrivilegedUser);
      await orchestrator.addFeaturesToUser(privilegedUser, ["update:user:others"]);

      const defaultUser = await orchestrator.createUser();

      const response = await fetch(`${webserver.origin}/api/v1/users/${defaultUser.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `session_id=${privilegedUserSession.token}`,
        },
        body: JSON.stringify({
          username: "alteradoPorPrivilegiado",
        }),
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "alteradoPorPrivilegiado",
        email: responseBody.email,
        password: responseBody.password,
        cpf: responseBody.cpf,
        avatar_image: responseBody.avatar_image,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        features: ["read:activation_token"],
        resumo: responseBody.resumo,
        visibility: responseBody.visibility,
        background_image: responseBody.background_image,
        bio: responseBody.bio,
      });
    });
  });
});
