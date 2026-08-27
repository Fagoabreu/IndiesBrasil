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

describe("GET/POST/PATCH/DELETE /api/v1/courses/[slug]/modules", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let createdCourse;
  let moduleId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoModulos",
      email: "dono.curso.modulos@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456710,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCursoModulos",
      email: "outro.curso.modulos@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456711,
    });
    otherToken = otherCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Módulos",
    });
  });

  test("Anonymous user can list modules", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      modules: [],
      unassignedLessons: [],
    });
  });

  test("Anonymous user cannot create a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Módulo Anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot create a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Módulo de Outro" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can create a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Módulo 1" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.title).toBe("Módulo 1");
    expect(body.order_index).toBe(0);
    moduleId = body.id;
  });

  test("Creating a module with short title returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "a" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner can update a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ moduleId, title: "Módulo Atualizado" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toBe("Módulo Atualizado");
  });

  test("Non-owner user cannot update a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ moduleId, title: "Módulo Invadido" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Non-owner user cannot delete a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "DELETE",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ moduleId }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a module", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/modules`, {
      method: "DELETE",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ moduleId }),
    });
    expect(response.status).toBe(204);
  });
});
