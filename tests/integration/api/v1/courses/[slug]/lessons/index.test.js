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

describe("GET/POST /api/v1/courses/[slug]/lessons", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoAulas",
      email: "dono.curso.aulas@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456706,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCursoAulas",
      email: "outro.curso.aulas@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456707,
    });
    otherToken = otherCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Aulas",
    });
  });

  test("Anonymous user can list lessons", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Aula Anônima" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot create a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Aula de Outro" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can create a lesson", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Aula 1", description: "Descrição da aula" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.title).toBe("Aula 1");
    expect(body.description).toBe("Descrição da aula");
    expect(body.order_index).toBe(0);
  });

  test("Creating a lesson with short title returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "a" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });
});
