import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import database from "infra/database";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import event from "models/event";
import post from "models/post";
import moderation from "models/moderation";

/**
 * Posts do evento usam a MESMA base de seleção do feed.
 *
 * A rota tinha uma query própria (`event.getEventPosts`) que devolvia um
 * subconjunto: sem `embed`, sem `comments_count`, sem `is_current_user` e sem o
 * filtro de moderação. A página do evento desenhava um card artesanal em que
 * vídeo, card de link e enquete não apareciam — e post bloqueado continuava
 * listado. Este teste fixa o contrato que a tela passou a exigir.
 */
const origin = webserver.origin;

let imageSequence = 0;
async function createImage(secureUrl) {
  imageSequence += 1;
  const id = `test-event-post-img-${imageSequence}`;
  await database.query({
    text: `INSERT INTO uploaded_images (id, filename, secure_url) VALUES ($1, $2, $3)`,
    values: [id, `${id}.png`, secureUrl],
  });
  return id;
}

describe("GET /api/v1/events/[id]/posts", () => {
  let author;
  let eventRow;
  let postWithMedia;
  let blockedPost;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    author = await createActivatedUserWithSession({
      username: "AutorPostEvento",
      email: "autor.post.evento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456701,
    });

    eventRow = await event.create(
      {
        title: "Evento com posts",
        description: "Evento para testar a listagem de posts.",
        starts_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: "public",
        status: "published",
      },
      author.user.id,
    );

    const imgId = await createImage("https://res.cloudinary.com/demo/image/upload/post-evento.png");

    postWithMedia = await post.create({
      author_id: author.user.id,
      event_id: eventRow.id,
      content: "Post do evento com mídia",
      img: imgId,
      embed: [{ type: "video", provider: "youtube", url: "https://www.youtube.com/watch?v=abc123" }],
    });

    blockedPost = await post.create({
      author_id: author.user.id,
      event_id: eventRow.id,
      content: "Post bloqueado do evento",
    });
    await moderation.createBlock({
      targetType: "post",
      targetId: blockedPost.id,
      reason: "violacao_termos",
      moderatorId: author.user.id,
    });
  });

  async function listPosts(token) {
    const response = await fetch(`${origin}/api/v1/events/${eventRow.id}/posts`, token ? { headers: authHeaders(token) } : undefined);
    const body = response.status === 200 ? await response.json() : null;
    return { response, body };
  }

  test("anônimo recebe imagem, embed, contagem de comentários e marca de autoria", async () => {
    const { response, body } = await listPosts();

    expect(response.status).toBe(200);

    const item = body.find((p) => p.id === postWithMedia.id);
    expect(item).toBeDefined();
    expect(item.post_img_url).toBe("https://res.cloudinary.com/demo/image/upload/post-evento.png");
    expect(item.embed).toHaveLength(1);
    expect(Number(item.comments_count)).toBe(0);
    expect(Number(item.likes_count)).toBe(0);
    expect(item.is_current_user).toBe(false);
    expect(item.event_id).toBe(eventRow.id);
  });

  test("não lista post bloqueado pela moderação", async () => {
    const { body } = await listPosts();

    expect(body.map((p) => p.id)).not.toContain(blockedPost.id);
  });

  test("quem escreveu é reconhecido como autor", async () => {
    const { body } = await listPosts(author.sessionToken);

    const item = body.find((p) => p.id === postWithMedia.id);
    expect(item.is_current_user).toBe(true);
  });
});
