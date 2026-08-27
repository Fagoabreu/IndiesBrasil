import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";
import contentReview from "models/content-review";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/PATCH/DELETE /api/v1/analises/[slug]", () => {
  let authorToken;
  let otherToken;
  let reviewSlug;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorSlug",
      email: "autor.slug@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456706,
    });
    authorToken = authorCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroSlug",
      email: "outro.slug@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456707,
    });
    otherToken = otherCtx.sessionToken;

    const studio = await organization.create(authorCtx.user, { name: "Estúdio Slug" });
    const createdGame = await game.create(studio.id, authorCtx.user.id, {
      name: "Jogo Slug",
      stage: "concept",
    });

    const review = await contentReview.create({
      title: "Análise Por Slug",
      authorId: authorCtx.user.id,
      contentType: "game",
      contentId: createdGame.id,
      rating: 3,
    });
    reviewSlug = review.slug;
  });

  test("Anonymous user can read a review by slug", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.slug).toBe(reviewSlug);
    expect(body.title).toBe("Análise Por Slug");
  });

  test("Reading a non-existent slug returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/slug-inexistente`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Título Alterado" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-author user cannot update a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Título Alterado" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Author can update a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`, {
      method: "PATCH",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({ rating: 4, positive_points: ["História boa"] }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.slug).toBe(reviewSlug);
    expect(body.rating).toBe(4);
    expect(body.positive_points).toEqual(["História boa"]);
  });

  test("Anonymous user cannot delete a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-author user cannot delete a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Author can delete a review", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}`, {
      method: "DELETE",
      headers: authHeaders(authorToken),
    });
    expect(response.status).toBe(204);
  });
});
