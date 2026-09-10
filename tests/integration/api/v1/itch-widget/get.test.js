import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/itch-widget", () => {
  test("Missing url parameter returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/itch-widget`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Parâmetro 'url' é obrigatório.");
  });

  test("Widget URL returns the numeric id and embed url", async () => {
    // Resolução direta (sem requisição externa): a URL já é a do widget.
    const response = await fetch(`${webserver.origin}/api/v1/itch-widget?url=${encodeURIComponent("https://itch.io/embed/216996")}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      id: "216996",
      embedUrl: "https://itch.io/embed/216996",
    });
  });

  test("Non itch.io URL returns 200 with null", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/itch-widget?url=${encodeURIComponent("https://store.steampowered.com/app/391540")}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toBeNull();
  });

  test("Unsafe (loopback) URL returns 200 with null", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/itch-widget?url=${encodeURIComponent("http://127.0.0.1:8080")}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toBeNull();
  });

  test("Malformed URL returns 200 with null", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/itch-widget?url=${encodeURIComponent("not-a-url")}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toBeNull();
  });
});
