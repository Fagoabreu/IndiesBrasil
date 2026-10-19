import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { authHeaders, createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import asset from "models/asset";
import assetCategory from "models/assetCategory";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Interações em assets", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let studio;
  let created;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoAssetInteracao",
      email: "dono.asset.interacao@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroAssetInteracao",
      email: "outro.asset.interacao@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456702,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Interações" });
    const sprites = await assetCategory.findBySlug("sprites");

    created = await asset.create(owner.id, studio.id, {
      name: "Asset Interativo",
      external_url: "https://exemplo.itch.io/asset-interativo",
      category_ids: [sprites.id],
    });
  });

  describe("Curtidas", () => {
    test("Visitante não curte nem vê o próprio estado", async () => {
      const post = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: true }),
      });

      expect(post.status).toBe(403);

      const detail = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`);
      const body = await detail.json();
      expect(body.viewer.likedByUser).toBe(false);
      expect(body.viewer.likesCount).toBe(0);
    });

    test("Usuário logado curte e descurte", async () => {
      const like = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/likes`, {
        method: "POST",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ liked: true }),
      });

      expect(like.status).toBe(201);
      expect(await like.json()).toEqual({ liked: true, action: "created" });

      const withLike = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
        headers: authHeaders(otherToken),
      });
      const withLikeBody = await withLike.json();
      expect(withLikeBody.viewer.likedByUser).toBe(true);
      expect(withLikeBody.viewer.likesCount).toBe(1);

      const unlike = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/likes`, {
        method: "POST",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ liked: false }),
      });

      expect(unlike.status).toBe(201);
      expect(await unlike.json()).toEqual({ liked: false, action: "removed" });
    });
  });

  describe("Comentários", () => {
    test("Visitante lê os comentários", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });

    test("Visitante não comenta", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Sem sessão" }),
      });

      expect(response.status).toBe(403);
    });

    test("Usuário logado comenta e o visitante vê", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`, {
        method: "POST",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Ótimo pacote!" }),
      });

      expect(response.status).toBe(201);

      const createdComment = await response.json();
      expect(createdComment.content).toBe("Ótimo pacote!");
      expect(createdComment.author_username).toBe("OutroAssetInteracao");

      const asVisitor = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`);
      const comments = await asVisitor.json();
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe("Ótimo pacote!");
    });

    test("Comentário vazio responde 400", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`, {
        method: "POST",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      });

      expect(response.status).toBe(400);
    });

    test("Outro usuário não apaga o comentário alheio", async () => {
      const list = await (await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`)).json();

      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments/${list[0].id}`, {
        method: "DELETE",
        headers: authHeaders(ownerToken),
      });

      expect(response.status).toBe(403);
    });

    test("O autor apaga o próprio comentário", async () => {
      const list = await (await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`)).json();

      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments/${list[0].id}`, {
        method: "DELETE",
        headers: authHeaders(otherToken),
      });

      expect(response.status).toBe(204);

      const after = await (await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/comments`)).json();
      expect(after).toEqual([]);
    });
  });

  describe("Avaliações", () => {
    test("Visitante lê a nota média e não avalia", async () => {
      const list = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`);
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([]);

      const post = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
      });

      expect(post.status).toBe(403);
    });

    test("Usuário logado avalia e a média aparece no detalhe", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`, {
        method: "POST",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4, content: "Bom custo-benefício" }),
      });

      expect(response.status).toBe(201);

      const review = await response.json();
      expect(review.rating).toBe(4);

      const detail = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`);
      const body = await detail.json();
      expect(Number(body.avg_rating)).toBe(4);
      expect(Number(body.review_count)).toBe(1);
    });

    test("Segunda avaliação do mesmo usuário responde 400", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`, {
        method: "POST",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 2 }),
      });

      expect(response.status).toBe(400);
    });

    test("O autor edita a própria nota", async () => {
      const detail = await (await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, { headers: authHeaders(otherToken) })).json();

      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`, {
        method: "PATCH",
        headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: detail.viewer.userReview.id, rating: 5 }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).rating).toBe(5);
    });

    test("Ninguém edita a nota de outra pessoa", async () => {
      const ownerDetail = await (
        await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, { headers: authHeaders(otherToken) })
      ).json();

      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`, {
        method: "PATCH",
        headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: ownerDetail.viewer.userReview.id, rating: 1 }),
      });

      expect(response.status).toBe(400);
    });

    test("Nota fora de 1 a 5 responde 400", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/reviews`, {
        method: "POST",
        headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 7 }),
      });

      expect(response.status).toBe(400);
    });
  });

  test("O estúdio recebe notificação de curtida, comentário e avaliação", async () => {
    await fetch(`${webserver.origin}/api/v1/assets/${created.slug}/likes`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "Content-Type": "application/json" },
      body: JSON.stringify({ liked: true }),
    });

    const notifications = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/notifications`, {
      headers: authHeaders(ownerToken),
    });

    expect(notifications.status).toBe(200);

    const list = await notifications.json();
    const types = list.map((item) => item.type);
    expect(types).toContain("org_asset_reviewed");
    expect(types).toContain("org_asset_liked");
  });
});
