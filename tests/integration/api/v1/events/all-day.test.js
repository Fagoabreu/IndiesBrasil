import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { brasiliaMonthRange } from "@/lib/eventFormat";

/**
 * Evento de dia inteiro — o dia gravado é o dia mostrado.
 *
 * O defeito: o formulário mandava o valor de `<input type="date">`
 * ("2026-10-12") e o model gravava com `new Date(...)`, que a especificação manda
 * ler como **meia-noite UTC**. Em Brasília isso é 21h do dia anterior, e o card
 * da agenda e da home mostrava o dia 11 para um evento marcado no dia 12.
 *
 * Estes testes vão pelo **HTTP**, e não pelo model: o que precisa valer é o que
 * o formulário manda. É a mesma razão de os eventos serem criados no intervalo
 * do próprio mês — era assim que a lista escondia o evento de dia inteiro de
 * duração zero.
 */

const origin = webserver.origin;

/** Mês escolhido para os testes: outubro de 2026 (mês cheio, sem ano bissexto). */
const ANO = 2026;
const MES = 9; // 0-indexado, como `Date#getMonth`

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
      const { response, body } = await createEvent(owner.sessionToken, {
        title: "Jam de um dia",
        starts_at: `${ANO}-10-12`,
        ends_at: `${ANO}-10-12`,
        is_all_day: true,
      });

      expect(response.status).toBe(201);
      // 00:00 de Brasília = 03:00Z. Era `2026-10-12T00:00:00.000Z` — 21h do dia
      // 11 em Brasília.
      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-12T03:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-13T03:00:00.000Z`);
    });

    test("vários dias: o intervalo cobre todos os dias escolhidos", async () => {
      const { body } = await createEvent(owner.sessionToken, {
        title: "Jam de três dias",
        starts_at: `${ANO}-10-20`,
        ends_at: `${ANO}-10-22`,
        is_all_day: true,
      });

      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-20T03:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-23T03:00:00.000Z`);
    });

    test("evento com hora continua sendo o instante digitado em Brasília", async () => {
      const { body } = await createEvent(owner.sessionToken, {
        title: "Evento com hora",
        starts_at: `${ANO}-10-12T20:00`,
        ends_at: `${ANO}-10-12T22:00`,
        is_all_day: false,
      });

      expect(new Date(body.starts_at).toISOString()).toBe(`${ANO}-10-12T23:00:00.000Z`);
      expect(new Date(body.ends_at).toISOString()).toBe(`${ANO}-10-13T01:00:00.000Z`);
    });

    test("término anterior ao início é recusado", async () => {
      const { response, body } = await createEvent(owner.sessionToken, {
        title: "Datas invertidas",
        starts_at: `${ANO}-10-22`,
        ends_at: `${ANO}-10-20`,
        is_all_day: true,
      });

      expect(response.status).toBe(400);
      expect(body.message).toBe("Data de término não pode ser anterior à de início.");
    });
  });

  describe("exibição no mês", () => {
    test("o dia inteiro do dia 1º aparece na lista do próprio mês", async () => {
      // Duração zero (início igual ao término) deixava `ei.ends_at > from` falso
      // para o primeiro dia do mês.
      const { body } = await createEvent(owner.sessionToken, {
        title: "Dia inteiro no dia 1º",
        starts_at: `${ANO}-10-01`,
        ends_at: `${ANO}-10-01`,
        is_all_day: true,
      });

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
      const { body } = await createEvent(owner.sessionToken, {
        title: "Jam que muda de data",
        starts_at: `${ANO}-10-05`,
        ends_at: `${ANO}-10-05`,
        is_all_day: true,
      });

      const antes = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(antes.starts_at).toISOString()).toBe(`${ANO}-10-05T03:00:00.000Z`);

      const { response } = await patchEvent(body.id, owner.sessionToken, {
        starts_at: `${ANO}-10-07`,
        ends_at: `${ANO}-10-08`,
        is_all_day: true,
      });
      expect(response.status).toBe(200);

      const depois = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(depois.starts_at).toISOString()).toBe(`${ANO}-10-07T03:00:00.000Z`);
      expect(new Date(depois.ends_at).toISOString()).toBe(`${ANO}-10-09T03:00:00.000Z`);
    });

    test("editar sem mexer na data não move o evento", async () => {
      const { body } = await createEvent(owner.sessionToken, {
        title: "Jam só de título",
        starts_at: `${ANO}-10-15`,
        ends_at: `${ANO}-10-15`,
        is_all_day: true,
      });

      await patchEvent(body.id, owner.sessionToken, { title: "Jam renomeada" });

      const instance = (await listMonth(owner.sessionToken)).find((row) => row.event_id === body.id);
      expect(new Date(instance.starts_at).toISOString()).toBe(`${ANO}-10-15T03:00:00.000Z`);
      expect(instance.title).toBe("Jam renomeada");
    });

    test("o que o formulário lê de volta é o mesmo dia que ele envia", async () => {
      // O `PATCH` do formulário reenvia o que leu. Se a leitura devolvesse o dia
      // do término exclusivo, cada save andaria um dia.
      const { body } = await createEvent(owner.sessionToken, {
        title: "Jam estável",
        starts_at: `${ANO}-10-10`,
        ends_at: `${ANO}-10-11`,
        is_all_day: true,
      });

      const { response } = await patchEvent(body.id, owner.sessionToken, {
        starts_at: `${ANO}-10-10`,
        ends_at: `${ANO}-10-11`,
        is_all_day: true,
      });

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
      const { response, body } = await createEvent(owner.sessionToken, {
        title: "Jam diária",
        starts_at: `${ANO}-10-01`,
        ends_at: `${ANO}-10-01`,
        is_all_day: true,
        is_recurring: true,
        recurrence_rule: { frequency: "daily", interval: 1, until_date: `${ANO}-10-04` },
      });
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
      const { response, body } = await createEvent(owner.sessionToken, {
        title: "Encontro das 21h",
        starts_at: `${ANO}-10-06T21:00`,
        ends_at: `${ANO}-10-06T22:00`,
        is_all_day: false,
        is_recurring: true,
        recurrence_rule: { frequency: "weekly", interval: 1, days_of_week: [2], until_date: `${ANO}-10-20` },
      });
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
