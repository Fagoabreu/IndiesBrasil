import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import event from "models/event";

/**
 * Quem enxerga cada evento — a regra de visibilidade da agenda.
 *
 * Estes testes existem porque a proteção era **só na tela**: `findAll` (a lista)
 * filtrava por visibilidade, mas `findById` (o detalhe) não filtrava nada. Um
 * visitante sem sessão lia título e descrição de evento `private` só sabendo o
 * UUID — e o endereço do evento é exatamente o que circula por fora do site,
 * porque é o link que se compartilha. Esconder na lista e entregar no detalhe
 * não é meia proteção: é a proteção que não existe.
 *
 * A asserção é sempre no **status**, de propósito: a resposta para "não pode
 * ver" tem de ser 404, e não 403. Um 403 confirmaria que existe um evento ali —
 * o mesmo critério de `models/conversation.js` para conversa de outra pessoa.
 */

const origin = webserver.origin;

async function getEvent(id, sessionToken) {
  const response = await fetch(`${origin}/api/v1/events/${id}`, sessionToken ? { headers: authHeaders(sessionToken) } : undefined);
  return { response, body: response.status === 200 ? await response.json() : null };
}

describe("Visibilidade do evento", () => {
  let owner;
  let visitor;
  let invited;
  let declined;
  const events = {};

  const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    owner = await createActivatedUserWithSession({
      username: "DonoEvento",
      email: "dono.evento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 11122233344,
    });
    visitor = await createActivatedUserWithSession({
      username: "VisitanteEvento",
      email: "visitante.evento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 22233344455,
    });
    invited = await createActivatedUserWithSession({
      username: "ConvidadoEvento",
      email: "convidado.evento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 33344455566,
    });
    declined = await createActivatedUserWithSession({
      username: "RecusouEvento",
      email: "recusou.evento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 44455566677,
    });

    for (const [key, visibility] of [
      ["public", "public"],
      ["members", "members"],
      ["private", "private"],
    ]) {
      events[key] = await event.create(
        {
          title: `Evento ${key}`,
          description: `Descrição do evento ${key}`,
          starts_at: inDays(3),
          ends_at: inDays(4),
          visibility,
          status: "published",
        },
        owner.user.id,
      );
    }

    // Convidado com convite **pendente** e outro que recusou: o aceite não é o
    // que dá acesso — o convite em aberto já dá, senão o convidado não leria o
    // evento que acabou de receber.
    await event.invite(events.private.id, invited.user.id, owner.user.id);
    await event.invite(events.private.id, declined.user.id, owner.user.id);
    await event.respondInvitation(events.private.id, declined.user.id, "declined");
  });

  test("Visitante sem sessão lê evento público", async () => {
    const { response, body } = await getEvent(events.public.id);

    expect(response.status).toBe(200);
    expect(body.title).toBe("Evento public");
  });

  test("Visitante sem sessão NÃO lê evento privado", async () => {
    const { response, body } = await getEvent(events.private.id);

    expect(response.status).toBe(404);
    // Nem o corpo vaza o conteúdo que motivou a proteção.
    expect(body).toBeNull();
  });

  test("Visitante sem sessão NÃO lê evento de membros", async () => {
    // `members` é a lista do meio e cai na mesma regra do privado para quem não
    // tem sessão — é o que a lista (`findAll`) já fazia, e o detalhe não.
    const { response } = await getEvent(events.members.id);

    expect(response.status).toBe(404);
  });

  test("Usuário autenticado lê evento de membros", async () => {
    const { response } = await getEvent(events.members.id, visitor.sessionToken);

    expect(response.status).toBe(200);
  });

  test("Usuário autenticado sem convite NÃO lê evento privado", async () => {
    const { response } = await getEvent(events.private.id, visitor.sessionToken);

    expect(response.status).toBe(404);
  });

  test("Quem criou lê o próprio evento privado", async () => {
    const { response } = await getEvent(events.private.id, owner.sessionToken);

    expect(response.status).toBe(200);
  });

  test("Convidado com convite pendente lê o evento privado", async () => {
    const { response } = await getEvent(events.private.id, invited.sessionToken);

    expect(response.status).toBe(200);
  });

  test("Quem recusou o convite deixa de ler o evento privado", async () => {
    const { response } = await getEvent(events.private.id, declined.sessionToken);

    expect(response.status).toBe(404);
  });

  test("A lista também esconde privado e de membros do visitante sem sessão", async () => {
    const response = await fetch(`${origin}/api/v1/events`);
    const body = await response.json();

    // Guarda de regressão do refactor: `findAll` e `findById` passaram a usar a
    // mesma condição (`visibilityCondition`); este teste fixa o lado da lista.
    const titles = body.map((row) => row.title);
    expect(titles).toContain("Evento public");
    expect(titles).not.toContain("Evento private");
    expect(titles).not.toContain("Evento members");
  });

  test("A página do evento privado responde 404 para o visitante sem sessão", async () => {
    // O SSR busca a API sem sessão, então herda a mesma regra — e a página já
    // saía 404 para evento inexistente. Sem isto, o HTML servido ao crawler
    // descreveria o evento restrito.
    const response = await fetch(`${origin}/agenda/${events.private.id}`);

    expect(response.status).toBe(404);
  });

  test("O card de preview do evento privado responde 404", async () => {
    // O card é buscado pelas redes sociais **sem sessão**: desenhá-lo exporia
    // título e local do evento restrito a quem só tem o link.
    const privado = await fetch(`${origin}/api/og/event/${events.private.id}`);
    const publico = await fetch(`${origin}/api/og/event/${events.public.id}`);

    expect(privado.status).toBe(404);
    expect(publico.status).toBe(200);
  });
});
