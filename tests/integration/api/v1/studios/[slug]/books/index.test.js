import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/POST /api/v1/studios/[slug]/books", () => {
  let ownerToken;
  let otherToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoStudioBooks",
      email: "dono.studio.books@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456845,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroStudioBooks",
      email: "outro.studio.books@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456846,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Studio Books" });
  });

  test("Anonymous user can list studio books", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/books`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/books`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Livro Anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot create a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/books`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Livro de Outro" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/books`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Livro do Estúdio", book_type: "book" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.title).toBe("Livro do Estúdio");
    expect(body.slug).toBeTruthy();
  });

  test("Owner cannot create a book without title", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/books`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Studio books list includes the created book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/books`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Livro do Estúdio");
  });
});
