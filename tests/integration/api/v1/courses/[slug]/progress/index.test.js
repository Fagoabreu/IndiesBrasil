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

describe("GET/POST /api/v1/courses/[slug]/progress", () => {
  let owner;
  let ownerToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoProgresso",
      email: "dono.curso.progresso@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456712,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Progresso",
    });

    await course.createLesson(createdCourse.slug, owner.id, {
      title: "Aula 1",
    });
  });

  test("Anonymous user cannot read progress", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/progress`);
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot mark progress", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: 0, completed: true }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can read empty progress", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/progress`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.totalCount).toBe(1);
    expect(body.completedCount).toBe(0);
    expect(body.lastCompletedOrder).toBeNull();
    expect(body.nextLessonOrder).toBe(0);
    expect(body.lessons).toHaveLength(1);
  });

  test("Activated user can mark a lesson completed", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/progress`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ order: 0, completed: true }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.completedCount).toBe(1);
    expect(body.totalCount).toBe(1);
    expect(body.lastCompletedOrder).toBe(0);
    expect(body.nextLessonOrder).toBeNull();
  });

  test("Activated user can mark a lesson incomplete", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/progress`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ order: 0, completed: false }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.completedCount).toBe(0);
    expect(body.totalCount).toBe(1);
    expect(body.lastCompletedOrder).toBeNull();
    expect(body.nextLessonOrder).toBe(0);
  });
});
