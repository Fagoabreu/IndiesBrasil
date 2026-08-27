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

describe("GET/PATCH/DELETE /api/v1/books/[slug]", () => {
  let ownerToken;
  let otherToken;
  let studio;
  let createdBook;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBookDetalhe",
      email: "dono.book.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456832,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroBookDetalhe",
      email: "outro.book.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456833,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Book Detalhe" });
    createdBook = await book.create(ownerCtx.user.id, studio.id, {
      title: "Livro Detalhe",
      book_type: "book",
      stage: "concept",
    });
  });

  test("Anonymous user can read book detail", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toBe("Livro Detalhe");
    expect(body.slug).toBe(createdBook.slug);
    expect(body.viewer).toMatchObject({
      isFollowing: false,
      canEdit: false,
      userReview: null,
    });
    expect(Array.isArray(body.store_pages)).toBe(true);
  });

  test("Owner reads detail with viewer context", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer).toMatchObject({
      isFollowing: false,
      canEdit: true,
      userReview: null,
    });
  });

  test("Reading a non-existent book returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/livro-inexistente`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtitle: "Novo subtítulo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot update a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ subtitle: "Novo subtítulo" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can update a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ subtitle: "Novo subtítulo" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.subtitle).toBe("Novo subtítulo");
  });

  test("Anonymous user cannot delete a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot delete a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
