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

async function createUser(username, email, cpf) {
  return await createActivatedUserWithSession({
    username,
    email,
    password: TEST_CREDENTIALS.userDefault,
    cpf,
  });
}

function meetingPayload(overrides = {}) {
  const now = Date.now();
  return {
    title: "Reunião de alinhamento",
    description: "Webconferência do estúdio.",
    starts_at: new Date(now + 60 * 60 * 1000).toISOString(),
    ends_at: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    max_participants: 20,
    ...overrides,
  };
}

describe("GET/POST/DELETE /api/v1/studios/[slug]/meetings", () => {
  let ownerToken;
  let memberToken;
  let outsiderToken;
  let outsiderUser;
  let studio;
  let memberMeetingId;
  let ownerMeetingId;
  let guestCode;

  beforeAll(async () => {
    const ownerCtx = await createUser("DonoReuniao", "dono.reuniao@curso.dev", 55123456901);
    ownerToken = ownerCtx.sessionToken;

    const memberCtx = await createUser("MembroReuniao", "membro.reuniao@curso.dev", 55123456902);
    memberToken = memberCtx.sessionToken;

    const outsiderCtx = await createUser("ForaReuniao", "fora.reuniao@curso.dev", 55123456903);
    outsiderToken = outsiderCtx.sessionToken;
    outsiderUser = outsiderCtx.user;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Reuniões" });

    // Membro entra pelo mesmo caminho do modelo (convite aceito, role padrão "member").
    const invitation = await organization.createInvitation(studio.id, memberCtx.user.id, ownerCtx.user.id);
    await organization.respondToInvitation(invitation.id, memberCtx.user.id, true);
  });

  test("Anonymous user cannot list meetings of a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`);
    expect(response.status).toBe(403);
  });

  test("Authenticated non-member cannot list meetings", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      headers: authHeaders(outsiderToken),
    });
    expect(response.status).toBe(403);
  });

  test("Member sees empty upcoming schedule", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      headers: authHeaders(memberToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test("Member can schedule a meeting", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      method: "POST",
      headers: { ...authHeaders(memberToken), "content-type": "application/json" },
      body: JSON.stringify(meetingPayload()),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    memberMeetingId = body.id;

    expect(body.title).toBe("Reunião de alinhamento");
    expect(body.status).toBe("scheduled");
    expect(body.room_id).toMatch(/^[a-f0-9]{32}$/);
    expect(body.org_slug).toBe(studio.slug);
    expect(body.guest_code_hash).toBeUndefined();
  });

  test("Meeting cannot be scheduled ending before it starts", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      method: "POST",
      headers: { ...authHeaders(memberToken), "content-type": "application/json" },
      body: JSON.stringify(
        meetingPayload({
          starts_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      ),
    });
    expect(response.status).toBe(400);
  });

  test("Non-member cannot schedule a meeting", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      method: "POST",
      headers: { ...authHeaders(outsiderToken), "content-type": "application/json" },
      body: JSON.stringify(meetingPayload()),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can schedule a meeting", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify(meetingPayload({ title: "Reunião do dono" })),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    ownerMeetingId = body.id;
    expect(body.title).toBe("Reunião do dono");
  });

  test("Member can read meeting details", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}`, {
      headers: authHeaders(memberToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(memberMeetingId);
    expect(body.guest_code_hash).toBeUndefined();
  });

  test("Meeting of another studio cannot be read through this slug", async () => {
    const otherStudio = await organization.create(outsiderUser, {
      name: "Estúdio Estrangeiro",
    });

    const response = await fetch(`${webserver.origin}/api/v1/studios/${otherStudio.slug}/meetings/${memberMeetingId}`, {
      headers: authHeaders(outsiderToken),
    });
    expect(response.status).toBe(404);
  });

  test("Owner (dono do estúdio) can update a meeting scheduled by a member", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Reunião atualizada", max_participants: 10 }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toBe("Reunião atualizada");
    expect(body.max_participants).toBe(10);
  });

  test("Regular member cannot update a meeting scheduled by the owner", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${ownerMeetingId}`, {
      method: "PATCH",
      headers: { ...authHeaders(memberToken), "content-type": "application/json" },
      body: JSON.stringify({ title: "Tentativa de membro comum" }),
    });
    expect(response.status).toBe(403);
  });

  test("Regular member cannot cancel a meeting scheduled by the owner", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${ownerMeetingId}`, {
      method: "DELETE",
      headers: authHeaders(memberToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner generates a guest code", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}/guest-code`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.id).toBe(memberMeetingId);
    expect(body.guest_code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    guestCode = body.guest_code;
  });

  test("Regular member cannot generate a guest code for a meeting scheduled by the owner", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${ownerMeetingId}/guest-code`, {
      method: "POST",
      headers: { ...authHeaders(memberToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
  });

  test("Guest cannot validate with a wrong code", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/${memberMeetingId}/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "ZZZZZZZZ" }),
    });
    expect(response.status).toBe(403);
  });

  test("Guest can validate the meeting with the generated code", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/${memberMeetingId}/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: guestCode }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.meeting.id).toBe(memberMeetingId);
    expect(body.meeting.title).toBe("Reunião atualizada");
    expect(body.meeting.room_id).toBeUndefined();
    expect(body.meeting.guest_code_hash).toBeUndefined();
  });

  test("Guest code is rejected for a non-existent meeting", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/00000000-0000-0000-0000-000000000000/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: guestCode }),
    });
    expect(response.status).toBe(404);
  });

  test("Owner can revoke the guest code", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}/guest-code`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });

  test("Guest code is invalid after revocation", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/${memberMeetingId}/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: guestCode }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can cancel the meeting (soft delete)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);
  });

  test("Cancelled meeting disappears from the default schedule", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings`, {
      headers: authHeaders(memberToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.some((item) => item.id === memberMeetingId)).toBe(false);
    expect(body.some((item) => item.id === ownerMeetingId)).toBe(true);
  });

  test("Cancelled meeting can still be listed explicitly", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings?status=cancelled`, {
      headers: authHeaders(memberToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.some((item) => item.id === memberMeetingId)).toBe(true);
  });

  test("Guest code is rejected after the meeting is cancelled", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/${memberMeetingId}/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: guestCode }),
    });
    expect(response.status).toBe(400);
  });

  test("Guest code cannot be regenerated for a cancelled meeting", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}/guest-code`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  test("Member can still read details of a cancelled meeting", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/meetings/${memberMeetingId}`, {
      headers: authHeaders(memberToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("cancelled");
  });
});
