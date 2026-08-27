import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/streams", () => {
  test("Anonymous user gets an empty list when no studio has channels", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/streams`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Anonymous user can list studios with streaming channels", async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "EstudioStream",
      email: "estudio.stream@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456701,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Com Stream" });
    await organization.update(studio.slug, { twitch_channel: "indiesbrasil" });

    const response = await fetch(`${webserver.origin}/api/v1/streams`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.length).toBe(1);
    expect(body[0].slug).toBe(studio.slug);
    expect(body[0].name).toBe("Estúdio Com Stream");
    expect(body[0].twitch_channel).toBe("indiesbrasil");
    expect(body[0].is_live).toBe(false);
    expect(body[0].active_platform).toBeNull();
  });
});
