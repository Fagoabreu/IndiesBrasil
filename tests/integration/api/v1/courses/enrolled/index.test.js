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

describe("GET /api/v1/courses/enrolled", () => {
  let owner;
  let ownerToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoMatriculas",
      email: "dono.curso.matriculas@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456702,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Matriculado",
      description: "Curso para teste de matrículas",
    });

    await course.enrollUser(createdCourse.slug, owner.id);
  });

  test("Anonymous user cannot list enrolled courses", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/enrolled`);
    expect(response.status).toBe(403);
  });

  test("Activated user can list enrolled courses", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/enrolled`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Curso Matriculado");
    expect(body[0].slug).toBe(createdCourse.slug);
  });

  test("Search filter returns matching enrolled courses", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/enrolled?search=Matriculado`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Curso Matriculado");
  });

  test("Search filter with no match returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/enrolled?search=Inexistente`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });
});
