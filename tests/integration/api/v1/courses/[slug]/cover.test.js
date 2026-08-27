import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import course from "models/course";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("POST/DELETE /api/v1/courses/[slug]/cover", () => {
  let owner;
  let ownerToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoCapa",
      email: "dono.curso.capa@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456705,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Capa",
    });
  });

  test("Anonymous user cannot update cover", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/cover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: "data:image/png;base64,AAAA" }),
    });
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot remove cover", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/cover`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Owner without image gets 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/cover`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner can remove cover (none set)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/cover`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      cover_url: null,
      cover_image_id: null,
    });
  });
});
