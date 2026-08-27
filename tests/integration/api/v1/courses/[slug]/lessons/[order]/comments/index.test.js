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

describe("GET/POST /api/v1/courses/[slug]/lessons/[order]/comments", () => {
  let owner;
  let ownerToken;
  let createdCourse;
  let lessonOrder;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoComentarios",
      email: "dono.curso.comentarios@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456716,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Comentários",
    });

    const createdLesson = await course.createLesson(createdCourse.slug, owner.id, {
      title: "Aula 1",
    });
    lessonOrder = createdLesson.order_index;
  });

  test("Anonymous user can list comments", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}/comments`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Comentário anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}/comments`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ content: "Ótima aula" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.content).toBe("Ótima aula");
    expect(body.author_id).toBe(owner.id);
  });

  test("Commenting with empty content returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}/comments`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ content: "   " }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Comments list shows the new comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}/comments`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].content).toBe("Ótima aula");
    expect(body[0].author_username).toBe("DonoCursoComentarios");
  });
});
