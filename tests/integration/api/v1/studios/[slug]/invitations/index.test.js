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

describe("GET/POST /api/v1/studios/[slug]/invitations", () => {
  let owner;
  let ownerToken;
  let memberB;
  let memberBToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoConvites",
      email: "dono.convites@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456709,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const memberBCtx = await createActivatedUserWithSession({
      username: "ConvidadoB",
      email: "convidado.b@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456710,
    });
    memberB = memberBCtx.user;
    memberBToken = memberBCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Convites" });
  });

  test("Anonymous user cannot list invitations", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`);
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot create an invitation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: memberB.username, role: "member" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot list invitations", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      headers: authHeaders(memberBToken),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot create an invitation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(memberBToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberB.username, role: "member" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can list an empty invitation list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Owner can invite a user", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberB.username, role: "member" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.invited_user_id).toBe(memberB.id);
    expect(body.status).toBe("pending");
    expect(body.role).toBe("member");
  });

  test("Owner sees the pending invitation in the list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].invited_username).toBe(memberB.username);
  });

  test("Owner cannot invite an existing member", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ username: owner.username, role: "member" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });
});
