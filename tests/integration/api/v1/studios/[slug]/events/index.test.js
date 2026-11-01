import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";
import event from "models/event";
import database from "infra/database";
import { buildEventPayload, emptyEventValues } from "@/components/Agenda/eventFormOptions";

/**
 * Eventos do estúdio.
 *
 * O que este arquivo fixa:
 *
 *  1. **`organization_id` vem do endereço**, não do corpo — senão qualquer conta
 *     criaria um evento "do estúdio" de outra pessoa;
 *  2. **o produto tem de ser do estúdio** — o `ON DELETE CASCADE` garante a
 *     limpeza, não a autoria; sem a checagem, um lançamento destacaria o jogo de
 *     outro estúdio;
 *  3. **evento `private` do estúdio continua visível para a equipe** e fora da
 *     agenda pública (a diferença entre "privado" e "escondido da equipe");
 *  4. **excluir o produto apaga o evento** (`CASCADE`), decisão explícita — um
 *     lançamento sem lançamento não deveria continuar na agenda.
 *
 * Os corpos saem de `buildEventPayload`, como em `all-day.test.js`: montar o
 * JSON à mão pularia o cliente e o teste mediria outra coisa.
 */

const origin = webserver.origin;

function formBody(overrides = {}, mode = "create") {
  return buildEventPayload({ ...emptyEventValues(), ...overrides }, { mode });
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Eventos do estúdio", () => {
  let owner;
  let ownerToken;
  let outsiderToken;
  let studio;
  let otherStudio;
  let otherOwnerId;
  let createdGame;
  let otherGame;
  let createdEvent;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoEventoEstudio",
      email: "dono.evento.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 67123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const outsiderCtx = await createActivatedUserWithSession({
      username: "ForaEventoEstudio",
      email: "fora.evento.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 67123456702,
    });
    outsiderToken = outsiderCtx.sessionToken;

    const otherOwnerCtx = await createActivatedUserWithSession({
      username: "OutroDonoEvento",
      email: "outro.dono.evento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 67123456703,
    });

    studio = await organization.create(owner, { name: "Estúdio Eventos" });
    otherStudio = await organization.create(otherOwnerCtx.user, { name: "Outro Estúdio Eventos" });
    otherOwnerId = otherOwnerCtx.user.id;

    createdGame = await game.create(studio.id, owner.id, { name: "Jogo do Lançamento" });
    otherGame = await game.create(otherStudio.id, otherOwnerCtx.user.id, { name: "Jogo de Outro Estúdio" });
  });

  test("Visitante não lista a agenda do estúdio", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`);
    expect(response.status).toBe(403);
  });

  test("Usuário de fora do estúdio não lista a agenda", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, {
      headers: authHeaders(outsiderToken),
    });
    expect(response.status).toBe(403);
  });

  test("Dono cria evento ligado ao estúdio e a um jogo", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify(
        formBody({
          title: "Lançamento do Jogo do Lançamento",
          eventType: "game_launch",
          visibility: "public",
          productType: "game",
          productId: createdGame.id,
        }),
      ),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.organization_id).toBe(studio.id);
    expect(body.organization_slug).toBe(studio.slug);
    expect(body.product_type).toBe("game");
    expect(body.product_name).toBe("Jogo do Lançamento");

    createdEvent = body;
  });

  test("O evento aparece na agenda pública", async () => {
    const response = await fetch(`${origin}/api/v1/events`);
    expect(response.status).toBe(200);

    const body = await response.json();
    const found = body.find((row) => row.event_id === createdEvent.id);
    expect(found).toBeTruthy();
  });

  test("Produto de outro estúdio é recusado", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify(
        formBody({
          title: "Evento com jogo alheio",
          productType: "game",
          productId: otherGame.id,
        }),
      ),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("não pertence a este estúdio");
  });

  test("Tipo de produto desconhecido responde 400", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify(formBody({ title: "Evento com tipo inválido", productType: "filme", productId: createdGame.id })),
    });

    expect(response.status).toBe(400);
  });

  test("Evento privado do estúdio fica fora da agenda pública e dentro do painel", async () => {
    const created = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify(formBody({ title: "Reunião interna de lançamento", visibility: "private" })),
    });
    expect(created.status).toBe(201);
    const privateEvent = await created.json();

    const publicList = await fetch(`${origin}/api/v1/events`);
    const publicBody = await publicList.json();
    expect(publicBody.find((row) => row.event_id === privateEvent.id)).toBeFalsy();

    const panel = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, { headers: authHeaders(ownerToken) });
    expect(panel.status).toBe(200);
    const panelBody = await panel.json();
    expect(panelBody.find((row) => row.event_id === privateEvent.id)).toBeTruthy();
  });

  test("O detalhe devolve o vínculo com o produto", async () => {
    const loaded = await event.findById(createdEvent.id, owner.id);
    expect(loaded.game_id).toBe(createdGame.id);
    expect(loaded.product_type).toBe("game");
  });

  test("Trocar o produto zera a coluna anterior", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events/${createdEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify({ product_type: null, product_id: null }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.game_id).toBeNull();
    expect(body.product_type).toBeNull();
  });

  test("O banco recusa dois produtos no mesmo evento", async () => {
    // O `CHECK` é a garantia final: a API nunca manda dois, mas um `INSERT`
    // manual ou um caminho novo de escrita precisam falhar no banco.
    await expect(
      database.query({
        text: `UPDATE events SET game_id = $2, boardgame_id = $3 WHERE id = $1`,
        values: [createdEvent.id, createdGame.id, createdGame.id],
      }),
    ).rejects.toThrow();
  });

  test("Excluir o jogo apaga o evento de lançamento (CASCADE)", async () => {
    const created = await fetch(`${origin}/api/v1/studios/${studio.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify(
        formBody({
          title: "Lançamento que some com o jogo",
          productType: "game",
          productId: createdGame.id,
        }),
      ),
    });
    const linked = await created.json();

    await game.deleteGame(createdGame.slug);

    const stillThere = await database.query({
      text: `SELECT 1 FROM events WHERE id = $1`,
      values: [linked.id],
    });

    expect(stillThere.rowCount).toBe(0);
  });

  test("Evento de outro estúdio responde 404 pelo painel deste", async () => {
    // Criado pelo **dono do outro estúdio**: `create` recusa estúdio de que
    // quem chama não participa, então usar o dono deste estúdio aqui testaria a
    // checagem de autoria, não a de vizinhança.
    const foreign = await event.create(
      {
        title: "Evento do outro estúdio",
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600_000).toISOString(),
        organization_id: otherStudio.id,
      },
      otherOwnerId,
    );

    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/events/${foreign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
      body: JSON.stringify({ title: "tentativa" }),
    });

    expect(response.status).toBe(404);
  });
});
