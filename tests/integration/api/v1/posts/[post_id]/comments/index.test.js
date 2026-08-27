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

describe("GET/POST /api/v1/posts/[post_id]/comments", () => {
  let author;
  let commenterToken;
  let mainPost;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorPostComent",
      email: "autor.post.coment@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456703,
    });
    author = authorCtx.user;

    const commenterCtx = await createActivatedUserWithSession({
      username: "Comentarista",
      email: "comentarista@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456704,
    });
    commenterToken = commenterCtx.sessionToken;

    mainPost = await post.create({
      author_id: author.id,
      content: "Post com comentários",
    });
  });

  test("Anonymous user can list comments (empty)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  test("Anonymous user cannot create a comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Comentário anônimo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Activated user can create a comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments`, {
      method: "POST",
      headers: { ...authHeaders(commenterToken), "content-type": "application/json" },
      body: JSON.stringify({ content: "Meu comentário" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.content).toBe("Meu comentário");
    expect(body.author_username).toBe("Comentarista");
    expect(body.is_current_user).toBe(true);
    expect(body.post_id).toBe(mainPost.id);
  });

  test("Anonymous user can list comments (public read)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].content).toBe("Meu comentário");
    expect(body[0].author_username).toBe("Comentarista");
  });
});
