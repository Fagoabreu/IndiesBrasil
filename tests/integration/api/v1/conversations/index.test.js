import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import organization from "models/organization";
import conversation from "models/conversation";
import moderation from "models/moderation";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Conversas diretas", () => {
  let alice;
  let bob;
  let carol;
  let owner;
  let laterMember;
  let admin;
  let studio;
  const conversationIds = {};

  beforeAll(async () => {
    alice = await createActivatedUserWithSession({
      username: "AliceMensagens",
      email: "alice.mensagens@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456911,
    });
    bob = await createActivatedUserWithSession({
      username: "BobMensagens",
      email: "bob.mensagens@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456912,
    });
    carol = await createActivatedUserWithSession({
      username: "CarolMensagens",
      email: "carol.mensagens@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456913,
    });
    owner = await createActivatedUserWithSession({
      username: "DonoMensagens",
      email: "dono.mensagens@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456914,
    });
    laterMember = await createActivatedUserWithSession({
      username: "EntraDepoisMensagens",
      email: "entra.depois.mensagens@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456915,
    });
    admin = await createAdminUser({
      username: "AdminMensagens",
      email: "admin.mensagens@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456916,
    });

    studio = await organization.create(owner.user, { name: "Estúdio Mensagens" });
  });

  /* =========================================================
   * Abertura
   * ========================================================= */

  test("Anonymous cannot list or open conversations", async () => {
    const listResponse = await fetch(`${webserver.origin}/api/v1/conversations`);
    expect(listResponse.status).toBe(403);

    const openResponse = await fetch(`${webserver.origin}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "user", target_id: bob.user.id }),
    });
    expect(openResponse.status).toBe(403);
  });

  test("User opens a conversation with another user", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ target_type: "user", target_id: bob.user.id }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.id).toBeDefined();
    conversationIds.aliceBob = body.id;
  });

  test("Opening the same conversation again returns the same one", async () => {
    // O par canônico e o índice único fazem a operação ser idempotente: `A → B`
    // e `B → A` caem na MESMA linha. Sem isso cada lado veria metade da história.
    const response = await fetch(`${webserver.origin}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(bob.sessionToken) },
      body: JSON.stringify({ target_type: "user", target_id: alice.user.id }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.id).toBe(conversationIds.aliceBob);
  });

  test("User cannot open a conversation with themselves", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ target_type: "user", target_id: alice.user.id }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Member cannot open a conversation with their own studio", async () => {
    // O estúdio só responde: uma conversa em que os dois lados são a mesma
    // pessoa não tem significado.
    const response = await fetch(`${webserver.origin}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(owner.sessionToken) },
      body: JSON.stringify({ target_type: "studio", target_id: studio.id }),
    });
    expect(response.status).toBe(400);
  });

  test("Outsider opens a conversation with a studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(carol.sessionToken) },
      body: JSON.stringify({ target_type: "studio", target_id: studio.id }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    conversationIds.carolStudio = body.id;
  });

  /* =========================================================
   * Listagem
   * ========================================================= */

  test("Both sides see the conversation in their inbox", async () => {
    const aliceList = await fetch(`${webserver.origin}/api/v1/conversations`, { headers: authHeaders(alice.sessionToken) });
    expect(aliceList.status).toBe(200);
    const aliceBody = await aliceList.json();
    expect(aliceBody.map((c) => c.id)).toContain(conversationIds.aliceBob);
    expect(aliceBody.find((c) => c.id === conversationIds.aliceBob).peer.id).toBe(bob.user.id);

    const bobList = await fetch(`${webserver.origin}/api/v1/conversations`, { headers: authHeaders(bob.sessionToken) });
    const bobBody = await bobList.json();
    expect(bobBody.find((c) => c.id === conversationIds.aliceBob).peer.id).toBe(alice.user.id);
  });

  test("User cannot act as someone else", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations?party_type=user&party_id=${alice.user.id}`, {
      headers: authHeaders(bob.sessionToken),
    });
    expect(response.status).toBe(403);
  });

  test("Non-member cannot read the studio inbox", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations?party_type=studio&party_id=${studio.id}`, {
      headers: authHeaders(alice.sessionToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner reads the studio inbox", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations?party_type=studio&party_id=${studio.id}`, {
      headers: authHeaders(owner.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    const found = body.find((c) => c.id === conversationIds.carolStudio);
    expect(found).toBeDefined();
    expect(found.peer.type).toBe("user");
    expect(found.peer.username).toBe("CarolMensagens");
  });

  /* =========================================================
   * Envio e leitura
   * ========================================================= */

  test("User sends a message", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ body: "Oi, Bob! Tudo bem?" }),
    });
    expect(response.status).toBe(201);

    const sent = await response.json();
    expect(sent.body).toBe("Oi, Bob! Tudo bem?");
    expect(sent.author.type).toBe("user");
    expect(sent.author.username).toBe("AliceMensagens");
    expect(sent.sent_by.username).toBe("AliceMensagens");
  });

  test("Unread counter reflects the message that was not read yet", async () => {
    // Roda ANTES de o Bob abrir a conversa: abrir marca como lida, então medir
    // depois daria zero e o teste passaria sem provar nada.
    const response = await fetch(`${webserver.origin}/api/v1/conversations/unread`, { headers: authHeaders(bob.sessionToken) });
    expect(response.status).toBe(200);

    const counters = await response.json();
    expect(counters.conversations).toBe(1);
    expect(counters.messages).toBe(1);
  });

  test("The recipient opens the conversation and reads it", async () => {
    const thread = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      headers: authHeaders(bob.sessionToken),
    });
    expect(thread.status).toBe(200);

    const body = await thread.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].body).toBe("Oi, Bob! Tudo bem?");
    expect(body.conversation.peer.username).toBe("AliceMensagens");
  });

  test("Reading the conversation clears the unread counter", async () => {
    // Abrir a conversa marca como lida — efeito esperado de abrir uma caixa de
    // entrada, e o que dispensa uma segunda requisição só para registrar leitura.
    const counters = await fetch(`${webserver.origin}/api/v1/conversations/unread`, { headers: authHeaders(bob.sessionToken) });
    expect((await counters.json()).messages).toBe(0);
  });

  test("Rejects a blank message", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ body: "   " }),
    });
    expect(response.status).toBe(400);
  });

  test("Rejects a message longer than the limit", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ body: "x".repeat(conversation.MAX_BODY_LENGTH + 1) }),
    });
    expect(response.status).toBe(400);
  });

  test("Outsider gets 404 on someone else's conversation", async () => {
    // 404 e não 403: confirmar a existência revelaria que duas outras pessoas
    // estão conversando.
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      headers: authHeaders(carol.sessionToken),
    });
    expect(response.status).toBe(404);
  });

  /* =========================================================
   * Estúdio
   * ========================================================= */

  test("Studio replies in its own name, recording the human author", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.carolStudio}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(owner.sessionToken) },
      body: JSON.stringify({
        body: "Obrigado pelo contato!",
        party_type: "studio",
        party_id: studio.id,
      }),
    });
    expect(response.status).toBe(201);

    const sent = await response.json();
    expect(sent.author.type).toBe("studio");
    expect(sent.author.name).toBe("Estúdio Mensagens");

    // `sent_by` é o humano: é o que permite à moderação atribuir um abuso numa
    // conversa de estúdio a uma pessoa.
    expect(sent.sent_by.username).toBe("DonoMensagens");
  });

  test("Member who joins later sees the previous history", async () => {
    const invitation = await organization.createInvitation(studio.id, laterMember.user.id, owner.user.id);
    await organization.respondToInvitation(invitation.id, laterMember.user.id, true);

    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.carolStudio}?party_type=studio&party_id=${studio.id}`, {
      headers: authHeaders(laterMember.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].body).toBe("Obrigado pelo contato!");
  });

  test("User cannot send as the studio they do not belong to", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.carolStudio}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ body: "Se passando pelo estúdio", party_type: "studio", party_id: studio.id }),
    });
    expect(response.status).toBe(403);
  });

  /* =========================================================
   * Silenciar
   * ========================================================= */

  test("User silences a conversation and it moves to the muted list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ muted: true }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).muted).toBe(true);

    const muted = await fetch(`${webserver.origin}/api/v1/conversations?scope=muted`, { headers: authHeaders(alice.sessionToken) });
    const mutedBody = await muted.json();
    expect(mutedBody.map((c) => c.id)).toContain(conversationIds.aliceBob);

    const inbox = await fetch(`${webserver.origin}/api/v1/conversations`, { headers: authHeaders(alice.sessionToken) });
    const inboxBody = await inbox.json();
    expect(inboxBody.find((c) => c.id === conversationIds.aliceBob).muted).toBe(true);
  });

  test("User unmutes a conversation from the muted list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ muted: false }),
    });
    expect(response.status).toBe(200);

    const muted = await fetch(`${webserver.origin}/api/v1/conversations?scope=muted`, { headers: authHeaders(alice.sessionToken) });
    expect(await muted.json()).toHaveLength(0);
  });

  /* =========================================================
   * Moderação
   * ========================================================= */

  test("Only administrators read a reported conversation", async () => {
    const denied = await fetch(`${webserver.origin}/api/v1/admin/conversations/${conversationIds.aliceBob}`, {
      headers: authHeaders(alice.sessionToken),
    });
    expect(denied.status).toBe(403);

    const allowed = await fetch(`${webserver.origin}/api/v1/admin/conversations/${conversationIds.aliceBob}`, {
      headers: authHeaders(admin.sessionToken),
    });
    expect(allowed.status).toBe(200);

    const body = await allowed.json();
    expect(body.conversation.participants).toHaveLength(2);
    expect(body.messages[0].body).toBe("Oi, Bob! Tudo bem?");
  });

  test("A frozen conversation is readable but nobody can write", async () => {
    await moderation.createBlock({
      targetType: "conversation",
      targetId: conversationIds.aliceBob,
      reason: "assedio",
      moderatorId: admin.user.id,
    });

    const send = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({ body: "Depois de congelada" }),
    });
    expect(send.status).toBe(403);

    // O histórico continua acessível: é o que a moderação precisa para julgar.
    const read = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.aliceBob}`, {
      headers: authHeaders(alice.sessionToken),
    });
    expect(read.status).toBe(200);
  });

  test("Only a participant can report the conversation", async () => {
    const outsider = await fetch(`${webserver.origin}/api/v1/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(carol.sessionToken) },
      body: JSON.stringify({
        target_type: "conversation",
        target_id: conversationIds.aliceBob,
        reason: "spam",
      }),
    });
    expect(outsider.status).toBe(403);

    const participant = await fetch(`${webserver.origin}/api/v1/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(alice.sessionToken) },
      body: JSON.stringify({
        target_type: "conversation",
        target_id: conversationIds.aliceBob,
        reason: "assedio",
        justification: "Mensagens ofensivas.",
      }),
    });
    expect(participant.status).toBe(201);
  });

  /* =========================================================
   * Notificações
   * ========================================================= */

  test("A new message notifies the recipient without duplicating", async () => {
    const notifications = await fetch(`${webserver.origin}/api/v1/users/${bob.user.username}/notifications`, {
      headers: authHeaders(bob.sessionToken),
    });
    expect(notifications.status).toBe(200);

    const body = await notifications.json();
    const messageNotifications = body.filter((n) => n.type === "new_message");
    // Uma linha por conversa/remetente, reativada a cada mensagem — não uma
    // notificação por mensagem.
    expect(messageNotifications).toHaveLength(1);
    expect(messageNotifications[0].is_read).toBe(false);
  });

  test("The studio inbox gets one notification per conversation", async () => {
    // Segunda mensagem da mesma conversa: a entrada é reposicionada, não
    // duplicada (índice único parcial em org_notifications).
    const second = await fetch(`${webserver.origin}/api/v1/conversations/${conversationIds.carolStudio}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(carol.sessionToken) },
      body: JSON.stringify({ body: "Só reforçando o pedido." }),
    });
    expect(second.status).toBe(201);

    const notifications = await fetch(`${webserver.origin}/api/v1/users/${owner.user.username}/notifications/org`, {
      headers: authHeaders(owner.sessionToken),
    });
    expect(notifications.status).toBe(200);

    const body = await notifications.json();
    const messageNotifications = body.filter((n) => n.type === "new_message" && n.resource_id === conversationIds.carolStudio);
    expect(messageNotifications).toHaveLength(1);
    expect(messageNotifications[0].subject_title).toContain("reforçando");
  });
});

describe("models/conversation", () => {
  test("Canonical pair keeps the same conversation for A→B and B→A", async () => {
    const first = await orchestrator.createUser({
      username: "ParCanonicoA",
      email: "par.canonico.a@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456921,
    });
    const second = await orchestrator.createUser({
      username: "ParCanonicoB",
      email: "par.canonico.b@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 56123456922,
    });

    const ab = await conversation.findOrCreateForUser({ userId: first.id, targetType: "user", targetId: second.id });
    const ba = await conversation.findOrCreateForUser({ userId: second.id, targetType: "user", targetId: first.id });

    expect(ab.id).toBe(ba.id);
    // O par é ordenado no banco (CHECK ROW(a) < ROW(b)), então a ordem não
    // depende de quem abriu.
    expect(ab.party_a_type < ab.party_b_type || (ab.party_a_type === ab.party_b_type && ab.party_a_id < ab.party_b_id)).toBe(true);
  });
});
