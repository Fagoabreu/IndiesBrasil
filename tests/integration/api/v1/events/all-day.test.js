import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { brasiliaMonthRange, allDayEndDate } from "@/lib/eventFormat";
import { buildEventPayload, emptyEventValues, eventValuesFromApi } from "@/components/Agenda/eventFormOptions";

/**
 * Evento de dia inteiro — o dia gravado é o dia mostrado.
 *
 * O defeito original: o formulário mandava o valor de `<input type="date">`
 * ("2026-10-12") e o model gravava com `new Date(...)`, que a especificação manda
 * ler como **meia-noite UTC**. Em Brasília isso é 21h do dia anterior, e o card
 * da agenda e da home mostrava o dia 11 para um evento marcado no dia 12.
 *
 * Depois do primeiro conserto, um segundo defeito apareceu em produção: o
 * formulário passou a converter o dia escolhido para instante **antes** de
 * enviar, e a meia-noite do dia 22 é indistinguível da fronteira de término do
 * dia 22 — o evento terminava no dia 21. A causa de ele escapar foi este arquivo:
 * os corpos eram escritos à mão (`ends_at: "2026-10-22"`), pulando o cliente.
 * Por isso os corpos daqui saem de `buildEventPayload` — a mesma função que a
 * página usa —, e o teste passa a cobrir o par cliente/servidor, não só o
 * servidor.
 *
 * Ainda vão pelo **HTTP**, e não pelo model: o que precisa valer é o que o
 * formulário manda.
 */

const origin = webserver.origin;

/** Mês escolhido para os testes: outubro de 2026 (mês cheio, sem ano bissexto). */
const ANO = 2026;
const MES = 9; // 0-indexado, como `Date#getMonth`

/**
 * Corpo da requisição como o formulário o monta.
 *
 * `mode: "create"` inclui a recorrência; `"edit"` não, porque ela só é editável
 * na criação — é a mesma variação que `EventForm` passa por prop.
 */
function formBody({ title, startsAt, endsAt, isAllDay = false, recurrence = null }, mode = "create") {
  const values = {
    ...emptyEventValues(),
    title,
    isAllDay,
    startsAt,
    endsAt,
    ...(recurrence ? { isRecurring: true, ...recurrence } : {}),
  };

  return buildEventPayload(values, { mode });
}

/**
 * Corpo do `PATCH` como a página de edição o monta: o evento que a API devolve
 * entra no formulário (`eventValuesFromApi`) e sai como payload.
 *
 * É o caminho que o defeito de produção percorria — simular `{ starts_at, ... }`
 * à mão teria deixado o bug passar de novo.
 */
function editBodyFromApi(apiEvent, overrides = {}) {
  return buildEventPayload({ ...eventValuesFromApi(apiEvent), ...overrides }, { mode: "edit" });
}

async function createEvent(sessionToken, body) {
  const response = await fetch(`${origin}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
    body: JSON.stringify(body),
  });
  return { response, body: response.status === 201 ? await response.json() : await response.json().catch(() => null) };
}

async function patchEvent(id, sessionToken, body) {
  const response = await fetch(`${origin}/api/v1/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
    body: JSON.stringify(body),
  });
  return { response, body: response.status === 200 ? await response.json() : null };
}

/** Lista o mês em que o evento deveria aparecer, com a mesma faixa que a agenda usa. */
async function listMonth(sessionToken) {
  // `brasiliaMonthRange` é o que a página da agenda envia — usar outra faixa aqui
  // testaria um intervalo que o app não usa.
  const { from, to } = brasiliaMonthRange(ANO, MES);
  const url = `${origin}/api/v1/events?from=${from.toISOString()}&to=${to.toISOString()}`;

  const response = await fetch(url, { headers: authHeaders(sessionToken) });
  return response.json();
}

describe("Evento de dia inteiro", () => {
  let owner;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    owner = await createActivatedUserWithSession({
      username: "DonoDiaInteiro",
      email: "dono.dia.inteiro@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55566677788,
    });
  });

  describe("criação", () => {
    test("um dia: início e término são as meia-noites de Brasília do dia", async () => {
      const { response, body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Jam de um dia", startsAt: `${ANO}-10-12`, endsAt: `${ANO}-10-12`, isAllDay: true }),
      );

      expect(response.status).toBe(201);
      // 00:00 de Brasília = 03:00Z. Era `2026-10-12T00:00:00.000Z` — 21h do dia
      // 11 em Brasília.
      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-12T03:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-13T03:00:00.000Z`);
    });

    test("vários dias: o intervalo cobre todos os dias escolhidos", async () => {
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Jam de três dias", startsAt: `${ANO}-10-20`, endsAt: `${ANO}-10-22`, isAllDay: true }),
      );

      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-20T03:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-23T03:00:00.000Z`);
    });

    test("o término gravado denota o último dia que o usuário escolheu", async () => {
      // O caso de produção: 20 a 22 de novembro, dia inteiro. O formulário
      // enviava a meia-noite do dia 22 como término, e a página mostrava 21.
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Canal 3 Expo", startsAt: `${ANO}-11-20`, endsAt: `${ANO}-11-22`, isAllDay: true }),
      );

      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-11-23T03:00:00.000Z`);
      // Lido pelo mesmo caminho da tela: o último dia incluído é o 22.
      expect(allDayEndDate(body.ends_at)).toBe(`${ANO}-11-22`);
    });

    test("a API também aceita o dia cru, como último dia incluído", async () => {
      // Contrato do servidor para quem não passa pelo formulário (curl, script):
      // data sem hora é o dia escolhido, não a fronteira.
      const { body } = await createEvent(owner.sessionToken, {
        title: "Jam por data crua",
        starts_at: `${ANO}-10-25`,
        ends_at: `${ANO}-10-26`,
        is_all_day: true,
      });

      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-25T03:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-27T03:00:00.000Z`);
      expect(allDayEndDate(body.ends_at)).toBe(`${ANO}-10-26`);
    });

    test("evento com hora continua sendo o instante digitado em Brasília", async () => {
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Evento com hora", startsAt: `${ANO}-10-12T20:00`, endsAt: `${ANO}-10-12T22:00` }),
      );

      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-12T23:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-13T01:00:00.000Z`);
    });

    test("término anterior ao início é recusado", async () => {
      const { response, body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Datas invertidas", startsAt: `${ANO}-10-22`, endsAt: `${ANO}-10-20`, isAllDay: true }),
      );

      expect(response.status).toBe(400);
      expect(body.message).toBe("Data de término não pode ser anterior à de início.");
    });
  });

  describe("exibição no mês", () => {
    test("o dia inteiro do dia 1º aparece na lista do próprio mês", async () => {
      // Duração zero (início igual ao término) deixava `ei.ends_at > from` falso
      // para o primeiro dia do mês.
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Dia inteiro no dia 1º", startsAt: `${ANO}-10-01`, endsAt: `${ANO}-10-01`, isAllDay: true }),
      );

      const list = await listMonth(owner.sessionToken);
      const instance = list.find((row) => row.event_id === body.id);

      expect(instance).toBeDefined();
      expect(instance.is_all_day).toBe(true);
      // O que o card mostra: 1º de outubro, e não 30 de setembro.
      expect(new Date(instance.starts_at).toISOString()).toBe(`${ANO}-10-01T03:00:00.000Z`);
    });
  });

  describe("edição", () => {
    test("mudar a data move o evento na lista, não só na página do evento", async () => {
      // A agenda e a home listam `event_instances`, e só o `create` gravava nessa
      // tabela: sem sincronizar, a página do evento mostrava a data nova e o card
      // continuava na antiga.
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Jam que muda de data", startsAt: `${ANO}-10-05`, endsAt: `${ANO}-10-05`, isAllDay: true }),
      );

      const antes = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(antes.starts_at).toISOString()).toBe(`${ANO}-10-05T03:00:00.000Z`);

      const { response } = await patchEvent(body.id, owner.sessionToken, editBodyFromApi(body, { startsAt: `${ANO}-10-07`, endsAt: `${ANO}-10-08` }));
      expect(response.status).toBe(200);

      const depois = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(depois.starts_at).toISOString()).toBe(`${ANO}-10-07T03:00:00.000Z`);
      expect(new Date(depois.ends_at).toISOString()).toBe(`${ANO}-10-09T03:00:00.000Z`);
    });

    test("editar sem mexer na data não move o evento", async () => {
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Jam só de título", startsAt: `${ANO}-10-15`, endsAt: `${ANO}-10-15`, isAllDay: true }),
      );

      const before = await patchEvent(body.id, owner.sessionToken, editBodyFromApi(body, { title: "Jam renomeada" }));
      expect(new Date(before.body.ends_at).toISOString()).toBe(`${ANO}-10-16T03:00:00.000Z`);

      const instance = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(instance.starts_at).toISOString()).toBe(`${ANO}-10-15T03:00:00.000Z`);
      expect(instance.title).toBe("Jam renomeada");
    });

    test("abrir e salvar sem mexer mantém o dia do término", async () => {
      // O `PATCH` do formulário reenvia o que leu (`eventValuesFromApi` →
      // `buildEventPayload`). Enquanto o envio pré-convertia o dia escolhido, cada
      // save encurtava o evento em um dia — e este teste é o que reproduz o
      // caminho real.
      const { body } = await createEvent(
        owner.sessionToken,
        formBody({ title: "Jam estável", startsAt: `${ANO}-10-10`, endsAt: `${ANO}-10-11`, isAllDay: true }),
      );

      const { response } = await patchEvent(body.id, owner.sessionToken, editBodyFromApi(body));

      expect(response.status).toBe(200);
      const instance = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(instance.starts_at).toISOString()).toBe(`${ANO}-10-10T03:00:00.000Z`);
      expect(new Date(instance.ends_at).toISOString()).toBe(`${ANO}-10-12T03:00:00.000Z`);
    });
  });

  describe("recorrência", () => {
    test("recorrente diário mantém o dia inteiro em todas as ocorrências", async () => {
      // `expandDaily` reconstruía o horário com `Date.UTC` sem hora, então da 2ª
      // ocorrência em diante a instância voltava para `00:00Z` — o dia anterior.
      const { response, body } = await createEvent(
        owner.sessionToken,
        formBody({
          title: "Jam diária",
          startsAt: `${ANO}-10-01`,
          endsAt: `${ANO}-10-01`,
          isAllDay: true,
          recurrence: { frequency: "daily", interval: 1, untilDate: `${ANO}-10-04` },
        }),
      );
      expect(response.status).toBe(201);

      const list = await listMonth(owner.sessionToken);
      const dias = list
        .filter((row) => row.event_id === body.id)
        .map((row) => new Date(row.starts_at).toISOString())
        .sort();

      expect(dias).toEqual([`${ANO}-10-01T03:00:00.000Z`, `${ANO}-10-02T03:00:00.000Z`, `${ANO}-10-03T03:00:00.000Z`, `${ANO}-10-04T03:00:00.000Z`]);
    });

    test("recorrente semanal às 21h mantém dia e hora", async () => {
      // Evento a partir das 21h de Brasília é o outro caso que a aritmética em
      // UTC errava: 21h BRT já é o dia seguinte em UTC, então o "toda terça"
      // caía em outra terça.
      const { response, body } = await createEvent(
        owner.sessionToken,
        formBody({
          title: "Encontro das 21h",
          startsAt: `${ANO}-10-06T21:00`,
          endsAt: `${ANO}-10-06T22:00`,
          recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [2], untilDate: `${ANO}-10-20` },
        }),
      );
      expect(response.status).toBe(201);

      const ocorrencias = (await listMonth(owner.sessionToken))
        .filter((row) => row.event_id === body.id)
        .map((row) => new Date(row.starts_at).toISOString())
        .sort();

      // 21h de Brasília em três terças-feiras seguidas = 00:00Z do dia seguinte.
      expect(ocorrencias).toEqual([`${ANO}-10-07T00:00:00.000Z`, `${ANO}-10-14T00:00:00.000Z`, `${ANO}-10-21T00:00:00.000Z`]);
    });
  });
});
