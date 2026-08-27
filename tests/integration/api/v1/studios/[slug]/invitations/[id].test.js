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

describe("PATCH/DELETE /api/v1/studios/[slug]/invitations/[id]", () => {
  let owner;
  let ownerToken;
  let memberB;
  let memberBToken;
  let memberC;
  let memberCToken;
  let studio;
  let invitationId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoConvite",
      email: "dono.convite@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456711,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const memberBCtx = await createActivatedUserWithSession({
      username: "ConvidadoResposta",
      email: "convidado.resposta@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456712,
    });
    memberB = memberBCtx.user;
    memberBToken = memberBCtx.sessionToken;

    const memberCCtx = await createActivatedUserWithSession({
      username: "NaoAdmin",
      email: "nao.admin@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456713,
    });
    memberC = memberCCtx.user;
    memberCToken = memberCCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Convite" });

    const invitation = await organization.createInvitation(studio.id, memberB.id, owner.id, { role: "member" });
    invitationId = invitation.id;
  });

  test("Anonymous user cannot respond to an invitation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations/${invitationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept: true }),
    });
    expect(response.status).toBe(403);
  });

  test("Anonymous user cannot cancel an invitation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations/${invitationId}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot cancel an invitation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations/${invitationId}`, {
      method: "DELETE",
      headers: authHeaders(memberCToken),
    });
    expect(response.status).toBe(403);
  });

  test("Invited user can accept an invitation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations/${invitationId}`, {
      method: "PATCH",
      headers: { ...authHeaders(memberBToken), "content-type": "application/json" },
      body: JSON.stringify({ accept: true }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("accepted");
  });

  test("An invitation cannot be responded to twice", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations/${invitationId}`, {
      method: "PATCH",
      headers: { ...authHeaders(memberBToken), "content-type": "application/json" },
      body: JSON.stringify({ accept: true }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner can cancel a pending invitation", async () => {
    const freshInvitation = await organization.createInvitation(studio.id, memberC.id, owner.id, { role: "member" });

    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/invitations/${freshInvitation.id}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });
});
