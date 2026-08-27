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

describe("GET/POST/PATCH /api/v1/books/[slug]/reviews", () => {
  let reviewerToken;
  let studio;
  let createdBook;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBookReview",
      email: "dono.book.review@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456836,
    });

    const reviewerCtx = await createActivatedUserWithSession({
      username: "AvaliadorBook",
      email: "avaliador.book@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456837,
    });
    reviewerToken = reviewerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Book Review" });
    createdBook = await book.create(ownerCtx.user.id, studio.id, {
      title: "Livro Avaliado",
    });
  });

  test("Anonymous user can list reviews", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Anonymous user cannot create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can create a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`, {
      method: "POST",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 5, content: "Excelente livro" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.rating).toBe(5);
    expect(body.content).toBe("Excelente livro");
  });

  test("Reviews list includes the created review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].rating).toBe(5);
    expect(body[0].username).toBe("AvaliadorBook");
  });

  test("Reviewer can edit their review via PATCH", async () => {
    const listResponse = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`);
    const reviews = await listResponse.json();
    const reviewId = reviews[0].id;

    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`, {
      method: "PATCH",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ reviewId, rating: 1, content: "Atualizado" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.rating).toBe(1);
    expect(body.content).toBe("Atualizado");
  });

  test("PATCH without reviewId returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/reviews`, {
      method: "PATCH",
      headers: { ...authHeaders(reviewerToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    });
    expect(response.status).toBe(400);
  });
});
