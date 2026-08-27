import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("POST/DELETE /api/v1/studios/[slug]/follow", () => {
  let followerToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoFollow",
      email: "dono.follow@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456704,
    });

    const followerCtx = await createActivatedUserWithSession({
      username: "SeguidorEstudio",
      email: "seguidor.follow@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456705,
    });
    followerToken = followerCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Follow" });
  });

  test("Anonymous user cannot follow a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/follow`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
  });

  test("Authenticated user can follow a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/follow`, {
      method: "POST",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(204);
  });

  test("Following reflects on the studio detail", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer.isFollowing).toBe(true);
  });

  test("Anonymous user cannot unfollow a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/follow`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Authenticated user can unfollow a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/follow`, {
      method: "DELETE",
      headers: authHeaders(followerToken),
    });
    expect(response.status).toBe(204);

    const detailResponse = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      headers: authHeaders(followerToken),
    });
    const body = await detailResponse.json();
    expect(body.viewer.isFollowing).toBe(false);
  });
});
