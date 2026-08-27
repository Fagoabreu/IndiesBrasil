import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/users/[username]/reputation", () => {
  let owner;
  let ownerToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoReputacao",
      email: "dono.reputacao@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 64123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;
  });

  test("Anonymous user sees only the public total", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/reputation`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.reputation).toBe("number");
    expect(body.events).toBeUndefined();
  });

  test("Owner sees the reputation total and events", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/reputation`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.reputation).toBe("number");
    expect(Array.isArray(body.events)).toBe(true);
  });

  test("Unknown username returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/NaoExiste/reputation`);
    expect(response.status).toBe(404);
  });
});
