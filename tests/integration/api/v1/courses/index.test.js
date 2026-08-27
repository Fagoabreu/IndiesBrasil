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

describe("GET/POST /api/v1/courses", () => {
  let owner;
  let ownerToken;
  let createdCourse;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoLista",
      email: "dono.curso.lista@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso da Lista",
      description: "Descrição do curso da lista",
    });
  });

  test("Anonymous user can list courses", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Curso da Lista");
    expect(body[0].slug).toBe(createdCourse.slug);
    expect(body[0].owner_username).toBe("DonoCursoLista");
  });

  test("Search filter returns matching courses", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses?search=Lista`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Curso da Lista");
  });

  test("Search filter with no match returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses?search=Inexistente`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Tag filter with no match returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses?tag=inexistente`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Curso Anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can create a course", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Novo Curso", description: "Descrição do novo curso" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.title).toBe("Novo Curso");
    expect(body.description).toBe("Descrição do novo curso");
    expect(typeof body.slug).toBe("string");
  });

  test("Creating a course with short title returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/courses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "ab" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });
});
