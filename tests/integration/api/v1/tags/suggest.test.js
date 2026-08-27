import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import tags from "models/tags";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/tags/suggest", () => {
  beforeAll(async () => {
    await tags.create("indie");
  });

  test("Anonymous user gets matching tag suggestions", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/tags/suggest?name=ind`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].name).toBe("indie");
    expect(body[0].id).toBe("indie");
  });

  test("Too-short search term returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/tags/suggest?name=in`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("No matching tag returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/tags/suggest?name=xyz`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });
});
