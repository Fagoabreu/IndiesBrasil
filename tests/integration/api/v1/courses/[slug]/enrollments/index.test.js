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

describe("GET/POST/DELETE /api/v1/courses/[slug]/enrollments", () => {
  let owner;
  let ownerToken;
  let other;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoInscricoes",
      email: "dono.curso.inscricoes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456714,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCursoInscricoes",
      email: "outro.curso.inscricoes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456715,
    });
    other = otherCtx.user;

    createdCourse = await course.create(owner.id, {
      title: "Curso Com Inscrições",
    });
  });

  test("Anonymous user can check enrollment status", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ enrolled: false });
  });

  test("Anonymous user cannot enroll", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: owner.id }),
    });
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot unenroll", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: owner.id }),
    });
    expect(response.status).toBe(403);
  });

  test("Enrolling without userId returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Enrolling another user returns 403", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ userId: other.id }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Activated user can enroll", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ userId: owner.id }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.enrolled).toBe(true);
  });

  test("Enrollment status reflects enrollment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ enrolled: true });
  });

  test("Activated user can unenroll", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses/${createdCourse.slug}/enrollments`, {
      method: "DELETE",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ userId: owner.id }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.unenrolled).toBe(true);
  });
});
