import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import meeting from "models/meeting";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/meetings/mine", () => {
  let ownerCtx;
  let memberCtx;
  let otherOwnerCtx;
  let semEstudioCtx;
  let studio;
  let otherStudio;
  let memberMeetingId;

  const emUmaHora = () => new Date(Date.now() + 60 * 60 * 1000);
  const emDuasHoras = () => new Date(Date.now() + 2 * 60 * 60 * 1000);

  beforeAll(async () => {
    ownerCtx = await createActivatedUserWithSession({
      username: "DonoMinhasReunioes",
      email: "dono.minhas.reunioes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456911,
    });
    memberCtx = await createActivatedUserWithSession({
      username: "MembroMinhasReunioes",
      email: "membro.minhas.reunioes@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456912,
    });
    otherOwnerCtx = await createActivatedUserWithSession({
      username: "DonoOutroEstudio",
      email: "dono.outro.estudio@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456913,
    });
    semEstudioCtx = await createActivatedUserWithSession({
      username: "SemEstudioMinhas",
      email: "sem.estudio.minhas@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456914,
    });

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Alfa" });

    // Membro entra pelo mesmo caminho do modelo (convite aceito).
    const invitation = await organization.createInvitation(studio.id, memberCtx.user.id, ownerCtx.user.id);
    await organization.respondToInvitation(invitation.id, memberCtx.user.id, true);

    const criada = await meeting.create(
      { org_id: studio.id, title: "Alinhamento do Alfa", starts_at: emUmaHora(), ends_at: emDuasHoras() },
      ownerCtx.user.id,
    );
    memberMeetingId = criada.id;

    // Segunda reunião do mesmo estúdio, cancelada — não pode aparecer.
    const cancelada = await meeting.create(
      { org_id: studio.id, title: "Reunião cancelada", starts_at: emUmaHora(), ends_at: emDuasHoras() },
      ownerCtx.user.id,
    );
    await meeting.cancel(cancelada.id, ownerCtx.user.id);

    // Estúdio de outra pessoa: o membro do Alfa não pode ver nada daqui.
    otherStudio = await organization.create(otherOwnerCtx.user, { name: "Estúdio Beta" });
    await meeting.create(
      { org_id: otherStudio.id, title: "Sigilosa do Beta", starts_at: emUmaHora(), ends_at: emDuasHoras() },
      otherOwnerCtx.user.id,
    );
  });

  test("Anonymous user cannot list own meetings", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/mine`);
    expect(response.status).toBe(403);
  });

  test("Member sees the meetings of their studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/mine`, {
      headers: authHeaders(memberCtx.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(memberMeetingId);
    expect(body[0].title).toBe("Alinhamento do Alfa");
    expect(body[0].org_slug).toBe(studio.slug);
    // O hash do código de convidado nunca sai na serialização.
    expect(body[0].guest_code_hash).toBeUndefined();
  });

  test("Cancelled meeting is not listed", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/mine`, {
      headers: authHeaders(memberCtx.sessionToken),
    });
    const body = await response.json();

    expect(body.map((m) => m.title)).not.toContain("Reunião cancelada");
  });

  test("Member does not see meetings of a studio they do not belong to", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/mine`, {
      headers: authHeaders(memberCtx.sessionToken),
    });
    const body = await response.json();

    expect(body.map((m) => m.title)).not.toContain("Sigilosa do Beta");
  });

  test("User who is not a member of any studio sees nothing", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/mine`, {
      headers: authHeaders(semEstudioCtx.sessionToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Meeting outside the requested range is not returned", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/meetings/mine?from=2020-01-01&to=2020-02-01`, {
      headers: authHeaders(memberCtx.sessionToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
