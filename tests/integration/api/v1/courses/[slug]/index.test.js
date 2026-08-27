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

describe("GET/PATCH/DELETE /api/v1/courses/[slug]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoDetalhe",
      email: "dono.curso.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456703,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCursoDetalhe",
      email: "outro.curso.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456704,
    });
    otherToken = otherCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Detalhe",
      description: "Descrição original",
    });
  });

  test("Anonymous user can read course detail", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toBe("Curso Detalhe");
    expect(body.slug).toBe(createdCourse.slug);
    expect(body.viewer).toBeNull();
    expect(Array.isArray(body.tags)).toBe(true);
    expect(Array.isArray(body.lessons)).toBe(true);
  });

  test("Owner reads detail with viewer context", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer).toMatchObject({
      isOwner: true,
      userRating: null,
      review: null,
    });
    expect(body.viewer.progress).toMatchObject({
      completedCount: 0,
      totalCount: 0,
    });
  });

  test("Reading a non-existent course returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/curso-inexistente`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot update a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can update a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.description).toBe("Nova descrição");
  });

  test("Anonymous user cannot delete a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot delete a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
