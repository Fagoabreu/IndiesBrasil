import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("DELETE /api/v1/games/[slug]/media/[mediaId]", () => {
  let ownerToken;
  let otherToken;
  let studio;
  let createdGame;
  let mediaId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoJogoMediaDel",
      email: "dono.jogo.mediadel@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456811,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroJogoMediaDel",
      email: "outro.jogo.mediadel@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456812,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Jogo Media Delete" });
    createdGame = await game.create(studio.id, ownerCtx.user.id, {
      name: "Jogo Media Delete",
    });

    const media = await game.addMedia(createdGame.id, {
      media_type: "video",
      url: "https://www.youtube.com/watch?v=xyz789",
    });
    mediaId = media.id;
  });

  test("Anonymous user cannot delete media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media/${mediaId}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-owner user cannot delete media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media/${mediaId}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete media", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media/${mediaId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);

    const listResponse = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}/media`);
    expect(await listResponse.json()).toEqual([]);
  });
});
