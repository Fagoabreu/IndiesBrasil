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

describe("GET/PATCH/DELETE /api/v1/courses/[slug]/lessons/[order]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let createdCourse;
  let lessonOrder;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoAulaDetalhe",
      email: "dono.curso.aula.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456708,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCursoAulaDetalhe",
      email: "outro.curso.aula.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456709,
    });
    otherToken = otherCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Aula Detalhe",
    });

    const createdLesson = await course.createLesson(createdCourse.slug, owner.id, {
      title: "Aula Original",
      description: "Descrição original",
    });
    lessonOrder = createdLesson.order_index;
  });

  test("Anonymous user can read a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toBe("Aula Original");
    expect(body.course_slug).toBe(createdCourse.slug);
  });

  test("Reading a non-existent lesson returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/99`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot update a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can update a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.description).toBe("Nova descrição");
  });

  test("Anonymous user cannot delete a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot delete a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
