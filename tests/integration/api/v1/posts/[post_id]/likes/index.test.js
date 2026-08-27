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

describe("POST /api/v1/posts/[post_id]/likes", () => {
  let authorToken;
  let likerToken;
  let mainPost;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorPostLike",
      email: "autor.post.like@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456707,
    });
    authorToken = authorCtx.sessionToken;

    const likerCtx = await createActivatedUserWithSession({
      username: "Curtidor",
      email: "curtidor@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456708,
    });
    likerToken = likerCtx.sessionToken;

    mainPost = await post.create({
      author_id: authorCtx.user.id,
      content: "Post para curtir",
    });
  });

  test("Anonymous user cannot like a post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/likes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ liked: true }),
    });
    expect(response.status).toBe(403);
  });

  test("Author cannot like own post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/likes`, {
      method: "POST",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({ liked: true }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Activated user can like a post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/likes`, {
      method: "POST",
      headers: { ...authHeaders(likerToken), "content-type": "application/json" },
      body: JSON.stringify({ liked: true }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toEqual({ liked: true, action: "created" });
  });

  test("Activated user can unlike a post", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/likes`, {
      method: "POST",
      headers: { ...authHeaders(likerToken), "content-type": "application/json" },
      body: JSON.stringify({ liked: false }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toEqual({ liked: false, action: "removed" });
  });

  test("Liking a non-existent post returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/999999999/likes`, {
      method: "POST",
      headers: { ...authHeaders(likerToken), "content-type": "application/json" },
      body: JSON.stringify({ liked: true }),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });
});
