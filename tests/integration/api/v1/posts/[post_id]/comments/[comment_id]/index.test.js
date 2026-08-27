import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import post from "models/post";
import comment from "models/comment";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("DELETE /api/v1/posts/[post_id]/comments/[comment_id]", () => {
  let author;
  let commenterToken;
  let otherToken;
  let mainPost;
  let commenterComment;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorPostComentDel",
      email: "autor.post.comentdel@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456705,
    });
    author = authorCtx.user;

    const commenterCtx = await createActivatedUserWithSession({
      username: "ComentaristaDel",
      email: "comentarista.del@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456706,
    });
    commenterToken = commenterCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroDel",
      email: "outro.del@post.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456709,
    });
    otherToken = otherCtx.sessionToken;

    mainPost = await post.create({
      author_id: author.id,
      content: "Post com comentário",
    });

    commenterComment = await comment.create({
      post_id: mainPost.id,
      author_id: commenterCtx.user.id,
      content: "Comentário do comentarista",
    });
  });

  test("Anonymous user cannot delete a comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments/${commenterComment.id}`, { method: "DELETE" });
    expect(response.status).toBe(403);
  });

  test("Non-author cannot delete another user's comment", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments/${commenterComment.id}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Comment author can delete own comment", async () => {
    const freshComment = await comment.create({
      post_id: mainPost.id,
      author_id: commenterComment.author_id,
      content: "Comentário para deletar",
    });

    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments/${freshComment.id}`, {
      method: "DELETE",
      headers: authHeaders(commenterToken),
    });
    expect(response.status).toBe(204);
  });

  test("Deleting a non-existent comment returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/posts/${mainPost.id}/comments/999999999`, {
      method: "DELETE",
      headers: authHeaders(commenterToken),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });
});
