import webserver from "@/infra/webserver";
import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/migrations", () => {
  describe("anonymous user", () => {
    test("Running pending Migrations", async () => {
      const response1 = await fetch(`${webserver.origin}/api/v1/migrations`, {
        method: "POST",
      });
      expect(response1.status).toBe(403);

      const responseBody = await response1.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "create:migration" para executar esta ação.',
        status_code: 403,
      });
    });
  });

  describe("default user", () => {
    test("Running pending Migrations", async () => {
      const createdUser = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const response1 = await fetch(`${webserver.origin}/api/v1/migrations`, {
        method: "POST",
        headers: {
          Cookies: `session_id=${sessionObject.token}`,
        },
      });
      expect(response1.status).toBe(403);

      const responseBody = await response1.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "create:migration" para executar esta ação.',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("Retrieve Pending Migrations", async () => {
      const createdUser = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(createdUser);
      await orchestrator.addFeaturesToUser(activatedUser, ["create:migration"]);

      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/migrations`, {
        method: "POST",
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(Array.isArray(responseBody)).toBe(true);
    });
  });
});
