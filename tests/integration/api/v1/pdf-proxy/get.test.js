import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/pdf-proxy", () => {
  test("Missing url parameter returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/pdf-proxy`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Missing url parameter");
  });

  test("Non-Cloudinary URL returns 400 Invalid URL", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/pdf-proxy?url=${encodeURIComponent("https://example.com/file.pdf")}`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid URL");
  });

  test("Loopback URL returns 400 Invalid URL", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/pdf-proxy?url=${encodeURIComponent("http://127.0.0.1/file.pdf")}`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid URL");
  });
});
