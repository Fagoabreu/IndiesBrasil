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

describe("POST/DELETE /api/v1/analises/[slug]/cover", () => {
  let authorToken;
  let otherToken;
  let reviewSlug;

  beforeAll(async () => {
    const authorCtx = await createActivatedUserWithSession({
      username: "AutorCapa",
      email: "autor.capa@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456708,
    });
    authorToken = authorCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroCapa",
      email: "outro.capa@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 80123456709,
    });
    otherToken = otherCtx.sessionToken;

    const studio = await organization.create(authorCtx.user, { name: "Estúdio Capa" });
    const createdGame = await game.create(studio.id, authorCtx.user.id, {
      name: "Jogo Capa",
      stage: "concept",
    });

    const review = await contentReview.create({
      title: "Análise Com Capa",
      authorId: authorCtx.user.id,
      contentType: "game",
      contentId: createdGame.id,
      rating: 5,
    });
    reviewSlug = review.slug;
  });

  test("Anonymous user cannot update cover", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}/cover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: "data:image/png;base64,AAAA" }),
    });
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot remove cover", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}/cover`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Author without image gets 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}/cover`, {
      method: "POST",
      headers: { ...authHeaders(authorToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Non-author user cannot remove cover", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}/cover`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Author can remove cover (none set)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/analises/${reviewSlug}/cover`, {
      method: "DELETE",
      headers: authHeaders(authorToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      cover_url: null,
      cover_image_id: null,
    });
  });
});
