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

describe("GET/PATCH/DELETE /api/v1/studios/[slug]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoDetalhe",
      email: "dono.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456702,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroDetalhe",
      email: "outro.detalhe@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456703,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(owner, {
      name: "Estúdio Detalhe",
      description: "Descrição original",
    });
  });

  test("Anonymous user can read studio detail", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Estúdio Detalhe");
    expect(body.slug).toBe(studio.slug);
    expect(body.viewer).toMatchObject({
      isOwner: false,
      isMember: false,
      isAdmin: false,
      isFollowing: false,
    });
    expect(body.members).toHaveLength(1);
    expect(body.members[0].username).toBe(owner.username);
  });

  test("Owner reads detail with viewer context", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.viewer).toMatchObject({
      isOwner: true,
      isMember: true,
      isAdmin: true,
      isFollowing: false,
    });
  });

  test("Reading a non-existent studio returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/estudio-inexistente`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Anonymous user cannot update a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot update a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can update a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ description: "Nova descrição" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.description).toBe("Nova descrição");
  });

  test("Anonymous user cannot delete a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
