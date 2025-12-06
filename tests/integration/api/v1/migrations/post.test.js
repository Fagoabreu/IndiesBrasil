import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
});

describe("POST /api/v1/migrations", () => {
  describe("anonymous user", () => {
    describe("Running pending migrations", () => {
      test("For the first Time", async () => {
        const response1 = await fetch("http://localhost:3000/api/v1/migrations", {
          method: "POST",
        });
        expect(response1.status).toBe(201);

        const responseBody = await response1.json();

        expect(Array.isArray(responseBody)).toBe(true);
        expect(responseBody.length).toBeGreaterThan(0);
      });

      test("For the second Time", async () => {
        const response2 = await fetch("http://localhost:3000/api/v1/migrations", {
          method: "POST",
        });
        expect(response2.status).toBe(200);

        const response2Body = await response2.json();

        expect(Array.isArray(response2Body)).toBe(true);
        expect(response2Body.length).toBe(0);
      });
    });
  });
});
