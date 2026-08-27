import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/image-proxy", () => {
  test("Missing url parameter returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/image-proxy`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Missing url parameter");
  });

  test("Unsafe (loopback) URL returns 400 Invalid URL", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/image-proxy?url=${encodeURIComponent("http://localhost:3000/pixel.png")}`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid URL");
  });

  test("Private-network URL returns 400 Invalid URL", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/image-proxy?url=${encodeURIComponent("http://192.168.0.1/pixel.png")}`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid URL");
  });
});
