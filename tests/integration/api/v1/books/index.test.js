import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import book from "models/book";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/books", () => {
  let owner;
  let ownerToken;
  let studio;
  let createdBook;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBookLista",
      email: "dono.book.lista@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456831,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Book Lista" });
    createdBook = await book.create(owner.id, studio.id, {
      title: "Livro da Lista",
      book_type: "book",
      stage: "concept",
    });
  });

  test("Anonymous user can list books", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Livro da Lista");
    expect(body[0].slug).toBe(createdBook.slug);
  });

  test("Search filter returns matching books", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books?search=Livro`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Livro da Lista");
  });

  test("Search filter with no match returns empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books?search=Inexistente`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Anonymous isfollowing falls back to full list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books?isfollowing=true`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Livro da Lista");
  });

  test("Activated user can list followed books", async () => {
    await book.followBook(createdBook.id, owner.id);

    const response = await fetch(`${webserver.origin}/api/v1/books?isfollowing=true`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Livro da Lista");
  });
});
