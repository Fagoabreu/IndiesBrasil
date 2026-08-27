import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import course from "models/course";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("PATCH/DELETE /api/v1/courses/[slug]/lessons/[order]/comments/[commentId]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let createdCourse;
  let lessonOrder;
  let commentId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoCursoComentarioDetalhe",
      email: "dono.curso.comentario.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456717,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCursoComentarioDetalhe",
      email: "outro.curso.comentario.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 60123456718,
    });
    otherToken = otherCtx.sessionToken;

    createdCourse = await course.create(owner.id, {
      title: "Curso Comentário Detalhe",
    });

    const createdLesson = await course.createLesson(createdCourse.slug, owner.id, {
      title: "Aula 1",
    });
    lessonOrder = createdLesson.order_index;

    const createdComment = await course.createLessonComment(createdCourse.slug, lessonOrder, owner.id, "Comentário original");
    commentId = createdComment.id;
  });

  const baseUrl = () => `${webserver.origin}/api/v1/courses/${createdCourse.slug}/lessons/${lessonOrder}/comments/${commentId}`;

  test("Anonymous user cannot update a comment", async () => {
    const response = await fetch(baseUrl(), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Comentário atualizado" }),
    });
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot delete a comment", async () => {
    const response = await fetch(baseUrl(), {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-author cannot update a comment", async () => {
    const response = await fetch(baseUrl(), {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ content: "Comentário atualizado" }),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Author can update a comment", async () => {
    const response = await fetch(baseUrl(), {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ content: "Comentário atualizado" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe("Comentário atualizado");
  });

  test("Non-author cannot delete a comment", async () => {
    const response = await fetch(baseUrl(), {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(404);
  });

  test("Author can delete a comment", async () => {
    const response = await fetch(baseUrl(), {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
