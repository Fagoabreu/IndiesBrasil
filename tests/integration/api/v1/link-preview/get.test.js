import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/link-preview", () => {
  test("Missing url parameter returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/link-preview`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Parâmetro 'url' é obrigatório.");
  });

  test("Unsafe (loopback) URL returns 200 with null preview", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/link-preview?url=${encodeURIComponent("http://127.0.0.1:8080")}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toBeNull();
  });
});
