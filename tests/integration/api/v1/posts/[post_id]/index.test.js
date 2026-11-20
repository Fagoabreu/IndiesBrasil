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

describe("PATCH /api/v1/posts/[post_id]", () => {
  let author;
  let authorToken;
  let otherToken;
  let editablePost;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorEdicao",
      email: "autor.edicao@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456703,
    });
    author = authorCtx.user;
    authorToken = authorCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroEdicao",
      email: "outro.edicao@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456704,
    });
    otherToken = otherCtx.sessionToken;

    editablePost = await post.create({
      author_id: author.id,
      content: "Texto original do post",
    });
  });

  async function patch(postId, content, token) {
    return fetch(`${webserver.origin}/api/v1/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? authHeaders(token) : {}) },
      body: JSON.stringify({ content }),
    });
  }

  test("autor edita o próprio post e a marca de edição é gravada", async () => {
    const response = await patch(editablePost.id, "Texto editado pelo autor", authorToken);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe("Texto editado pelo autor");
    expect(body.edited_at).not.toBeNull();
    expect(body.id).toBe(editablePost.id);
  });

  test("a edição recalcula as tags do texto", async () => {
    const taggedPost = await post.create({ author_id: author.id, content: "Post sobre #rpg" });

    const response = await patch(taggedPost.id, "Agora o assunto é #pixelart", authorToken);
    expect(response.status).toBe(200);

    const porTagAntiga = await fetch(`${webserver.origin}/api/v1/posts?search_type=tag&tag=rpg`, { headers: authHeaders(authorToken) });
    const antigas = await porTagAntiga.json();
    expect(antigas.map((item) => item.id)).not.toContain(taggedPost.id);

    const porTagNova = await fetch(`${webserver.origin}/api/v1/posts?search_type=tag&tag=pixelart`, { headers: authHeaders(authorToken) });
    const novas = await porTagNova.json();
    expect(novas.map((item) => item.id)).toContain(taggedPost.id);
  });

  test("anônimo não pode editar", async () => {
    const response = await patch(editablePost.id, "Tentativa anônima");
    expect(response.status).toBe(403);
  });

  test("quem não é o autor recebe 404 (não confirma que o post existe)", async () => {
    const response = await patch(editablePost.id, "Tentativa de terceiro", otherToken);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("conteúdo vazio é recusado", async () => {
    const response = await patch(editablePost.id, "   ", authorToken);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("post inexistente responde 404", async () => {
    const response = await patch(999999999, "Texto qualquer", authorToken);
    expect(response.status).toBe(404);
  });
});
