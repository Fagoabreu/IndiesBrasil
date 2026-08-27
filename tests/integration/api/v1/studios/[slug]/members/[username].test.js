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

describe("PATCH/DELETE /api/v1/studios/[slug]/members/[username]", () => {
  let owner;
  let ownerToken;
  let memberB;
  let memberBToken;
  let memberC;
  let memberCToken;
  let studio;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoMembros",
      email: "dono.membros@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456706,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const memberBCtx = await createActivatedUserWithSession({
      username: "MembroB",
      email: "membro.b@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456707,
    });
    memberB = memberBCtx.user;
    memberBToken = memberBCtx.sessionToken;

    const memberCCtx = await createActivatedUserWithSession({
      username: "MembroC",
      email: "membro.c@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456708,
    });
    memberC = memberCCtx.user;
    memberCToken = memberCCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Membros" });

    const invB = await organization.createInvitation(studio.id, memberB.id, owner.id, { role: "member" });
    await organization.respondToInvitation(invB.id, memberB.id, true);

    const invC = await organization.createInvitation(studio.id, memberC.id, owner.id, { role: "member" });
    await organization.respondToInvitation(invC.id, memberC.id, true);
  });

  test("Anonymous user cannot manage member roles", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberB.username}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addRole: "admin" }),
    });
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot remove a member", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberB.username}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin member cannot manage roles", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberC.username}`, {
      method: "PATCH",
      headers: { ...authHeaders(memberBToken), "content-type": "application/json" },
      body: JSON.stringify({ addRole: "admin" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner cannot assign an invalid role", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberB.username}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ addRole: "superadmin" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner can promote a member to admin", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberB.username}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ addRole: "admin" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    const memberEntry = body.find((m) => m.username === memberB.username);
    expect(memberEntry.roles).toContain("admin");
  });

  test("Owner cannot remove the studio owner", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${owner.username}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin member cannot remove another member", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberB.username}`, {
      method: "DELETE",
      headers: authHeaders(memberCToken),
    });
    expect(response.status).toBe(403);
  });

  test("Member can remove themselves", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/members/${memberB.username}`, {
      method: "DELETE",
      headers: authHeaders(memberBToken),
    });
    expect(response.status).toBe(204);
  });
});
