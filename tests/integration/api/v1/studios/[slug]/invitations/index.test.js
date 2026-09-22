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
  let memberC;
  let memberD;
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

    const memberCCtx = await createActivatedUserWithSession({
      username: "ConvidadoC",
      email: "convidado.c@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456711,
    });
    memberC = memberCCtx.user;

    const memberDCtx = await createActivatedUserWithSession({
      username: "ConvidadoD",
      email: "convidado.d@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456712,
    });
    memberD = memberDCtx.user;

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

  test("Owner cannot invite with an unknown role", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberC.username, role: "superadmin" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner cannot invite with an explicit null role", async () => {
    // Campo ausente vira "member"; `null` explícito é erro do cliente e violaria
    // o NOT NULL do enum se passasse direto.
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberC.username, role: null }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner can invite with the admin role", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberC.username, role: "admin" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.role).toBe("admin");
  });

  test("Admin cannot invite with the admin role", async () => {
    // Prepara um administrador: memberB aceita o convite pendente e é promovido
    // pelo dono. É o caminho real, e é justamente o que precisa estar fechado —
    // o papel do convite vira `setMemberRole` no aceite.
    const pending = await organization.findPendingInvitations(studio.id);
    const inviteForB = pending.find((i) => i.invited_user_id === memberB.id);
    await organization.respondToInvitation(inviteForB.id, memberB.id, true);
    await organization.setMemberRole(studio.id, memberB.id, "admin", owner.id);

    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(memberBToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberD.username, role: "admin" }),
    });
    expect(response.status).toBe(403);
  });

  test("Admin can still invite with the member role", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations`, {
      method: "POST",
      headers: { ...authHeaders(memberBToken), "content-type": "application/json" },
      body: JSON.stringify({ username: memberD.username, role: "member" }),
    });
    expect(response.status).toBe(201);
  });
});
