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

describe("POST/DELETE /api/v1/books/[slug]/follow", () => {
  let followerToken;
  let studio;
  let createdBook;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoBookFollow",
      email: "dono.book.follow@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456834,
    });

    const followerCtx = await createActivatedUserWithSession({
      username: "SeguidorBook",
      email: "seguidor.book@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456835,
    });
    followerToken = followerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Book Follow" });
    createdBook = await book.create(ownerCtx.user.id, studio.id, {
      title: "Livro Seguido",
    });
  });

  test("Anonymous user cannot follow a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/follow`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can follow a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ following: true });
  });

  test("Detail reflects following state after follow", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}`, {
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer.isFollowing).toBe(true);
  });

  test("Anonymous user cannot unfollow a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/follow`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can unfollow a book", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books/${createdBook.slug}/follow`, {
      method: "DELETE",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ following: false });
  });
});
