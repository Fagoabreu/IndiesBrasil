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

describe("GET/POST /api/v1/courses/[slug]/ratings", () => {
  let owner;
  let ownerToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoAvaliacoes",
      email: "dono.curso.avaliacoes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456713,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Avaliações",
    });
  });

  test("Anonymous user can list ratings", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/ratings`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot rate a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/ratings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 5, review: "Ótimo curso" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can rate a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/ratings`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 5, review: "Ótimo curso" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.rating).toBe(5);
    expect(body.review).toBe("Ótimo curso");
  });

  test("Rating with invalid value returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/ratings`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 6 }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Ratings list shows the new rating", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/ratings`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].rating).toBe(5);
    expect(body[0].username).toBe("DonoCursoAvaliacoes");
  });
});
