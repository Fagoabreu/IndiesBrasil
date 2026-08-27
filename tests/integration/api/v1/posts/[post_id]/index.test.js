import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import post from "models/post";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/DELETE /api/v1/posts/[post_id]", () => {
  let author;
  let authorToken;
  let otherToken;
  let mainPost;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorPost",
      email: "autor.post@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456701,
    });
    author = authorCtx.user;
    authorToken = authorCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroPost",
      email: "outro.post@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456702,
    });
    otherToken = otherCtx.sessionToken;

    mainPost = await post.create({
      author_id: author.id,
      content: "Post principal de teste",
    });
  });

  test("Anonymous user can read a post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(mainPost.id);
    expect(body.content).toBe("Post principal de teste");
    expect(body.author_username).toBe("AutorPost");
    expect(body.is_current_user).toBeNull();
  });

  test("Authenticated user can read a post with is_current_user", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}`, {
      headers: authHeaders(authorToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(mainPost.id);
    expect(body.is_current_user).toBe(true);
  });

  test("Reading a non-existent post returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/999999999`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot delete a post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-author cannot delete a post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Author can delete own post", async () => {
    const freshPost = await post.create({
      author_id: author.id,
      content: "Post para deletar",
    });

    const response = await fetch(`${webserver.origin}/api/v1/posts/${freshPost.id}`, {
      method: "DELETE",
      headers: authHeaders(authorToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(freshPost.id);
  });
});
