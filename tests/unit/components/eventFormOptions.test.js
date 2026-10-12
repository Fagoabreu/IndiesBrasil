import { buildEventPayload, emptyEventValues, eventValuesFromApi, localDatetimeFromNow, validateEvent } from "@/components/Agenda/eventFormOptions";
import { allDayEndDate } from "@/lib/eventFormat";

/**
 * O que o formulário de evento envia e o que ele lê de volta.
 *
 * É a ponta onde o defeito do dia inteiro nasceu: o valor de `<input type="date">`
 * não tem fuso, e era lido com `new Date(...)` — que a especificação manda
 * interpretar como **meia-noite UTC**, 21h do dia anterior em Brasília. Aqui o
 * valor do input é lido como hora de Brasília, o mesmo fuso em que a agenda
 * exibe.
 *
 * Não depende de banco: é conversão de função pura, e o teste roda no fuso do
 * runner (UTC) justamente para provar que a saída não depende dele.
 */

/** Valores do formulário, com o que o teste quer definir por cima. */
function values(overrides) {
  return { ...emptyEventValues(), title: "Evento de teste", ...overrides };
}

describe("components/Agenda/eventFormOptions.js", () => {
  describe("buildEventPayload()", () => {
    test("dia inteiro: o início é a meia-noite de Brasília do dia escolhido", () => {
      const payload = buildEventPayload(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-12" }), { mode: "create" });

      // Era "2026-10-12T00:00:00.000Z" — 21h do dia 11 em Brasília.
      expect(payload.starts_at).toBe("2026-10-12T03:00:00.000Z");
      expect(payload.is_all_day).toBe(true);
    });

    test("dia inteiro: o término é a fronteira DEPOIS do último dia escolhido", () => {
      const payload = buildEventPayload(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-12" }), { mode: "create" });

      // Não "2026-10-12T03:00:00.000Z": isso é a meia-noite do dia 12, que a API
      // lê como fronteira do dia 12 — e o evento terminaria no dia 11.
      expect(payload.ends_at).toBe("2026-10-13T03:00:00.000Z");
    });

    test("o término enviado denota exatamente o último dia escolhido", () => {
      // O invariante que o bug de produção violava, e que os testes anteriores
      // não checavam: o payload tem que voltar pelo mesmo caminho com que a tela
      // lê (`allDayEndDate`) devolvendo o dia que o usuário digitou. Vale para
      // um dia e para vários, porque a conversão é a mesma nos dois casos.
      for (const [inicio, fim] of [
        ["2026-10-12", "2026-10-12"],
        ["2026-10-12", "2026-10-14"],
        ["2026-11-20", "2026-11-22"],
      ]) {
        const payload = buildEventPayload(values({ isAllDay: true, startsAt: inicio, endsAt: fim }), { mode: "create" });

        expect(allDayEndDate(payload.ends_at)).toBe(fim);
      }
    });

    test("com hora: o horário digitado é hora de Brasília", () => {
      const payload = buildEventPayload(values({ startsAt: "2026-10-12T20:00", endsAt: "2026-10-12T22:00" }), { mode: "create" });

      expect(payload.starts_at).toBe("2026-10-12T23:00:00.000Z");
      expect(payload.ends_at).toBe("2026-10-13T01:00:00.000Z");
    });

    test("o payload não depende do fuso de quem preencheu", () => {
      // Duas leituras do mesmo valor têm que dar o mesmo instante, não importa a
      // máquina: é o que `wallClockToInstant` garante e o que `new Date(...)` não
      // garantia.
      const um = buildEventPayload(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-14" }), { mode: "create" });
      const outro = buildEventPayload(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-14" }), { mode: "create" });

      expect(um).toEqual(outro);
      expect(um.starts_at).toBe("2026-10-12T03:00:00.000Z");
      expect(um.ends_at).toBe("2026-10-15T03:00:00.000Z");
    });
  });

  describe("eventValuesFromApi()", () => {
    test("dia inteiro: o input de término mostra o dia escolhido, não o fim exclusivo", () => {
      const form = eventValuesFromApi({
        title: "Jam",
        is_all_day: true,
        // 00:00 do dia 12 até 00:00 do dia 13 (fim exclusivo) = um dia.
        starts_at: "2026-10-12T03:00:00.000Z",
        ends_at: "2026-10-13T03:00:00.000Z",
      });

      expect(form.startsAt).toBe("2026-10-12");
      expect(form.endsAt).toBe("2026-10-12");
    });

    test("dia inteiro de vários dias", () => {
      const form = eventValuesFromApi({
        title: "Jam",
        is_all_day: true,
        starts_at: "2026-10-12T03:00:00.000Z",
        ends_at: "2026-10-15T03:00:00.000Z",
      });

      expect(form.startsAt).toBe("2026-10-12");
      expect(form.endsAt).toBe("2026-10-14");
    });

    test("com hora: o valor do input é a hora de Brasília", () => {
      const form = eventValuesFromApi({
        title: "Evento",
        is_all_day: false,
        starts_at: "2026-10-12T23:00:00.000Z",
        ends_at: "2026-10-13T01:00:00.000Z",
      });

      expect(form.startsAt).toBe("2026-10-12T20:00");
      expect(form.endsAt).toBe("2026-10-12T22:00");
    });

    test("abrir e salvar sem mexer não anda um dia", () => {
      // É o caminho completo do "editar e salvar": o que o formulário leu volta
      // igual no payload. A versão anterior deste teste afirmava
      // `payload.ends_at === api.starts_at` — isto é, exigia o encurtamento de um
      // dia a cada save, que foi exatamente o defeito visto em produção.
      const api = { title: "Jam", is_all_day: true, starts_at: "2026-10-12T03:00:00.000Z", ends_at: "2026-10-13T03:00:00.000Z" };

      const form = eventValuesFromApi(api);
      const payload = buildEventPayload(form, { mode: "edit" });

      expect(payload.starts_at).toBe(api.starts_at);
      expect(payload.ends_at).toBe(api.ends_at);
    });

    test("salvar de novo depois de vários dias mantém o intervalo", () => {
      const api = { title: "Jam", is_all_day: true, starts_at: "2026-11-20T03:00:00.000Z", ends_at: "2026-11-23T03:00:00.000Z" };

      // Dois saves seguidos, como dois cliques em "Salvar Alterações".
      const primeiro = buildEventPayload(eventValuesFromApi(api), { mode: "edit" });
      const segundo = buildEventPayload(eventValuesFromApi({ ...api, ...primeiro, title: api.title }), { mode: "edit" });

      expect(primeiro.ends_at).toBe(api.ends_at);
      expect(segundo.ends_at).toBe(api.ends_at);
    });
  });

  describe("emptyEventValues()", () => {
    test("o padrão de criação é um horário de Brasília no formato do input", () => {
      const defaults = emptyEventValues();

      expect(defaults.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(defaults.endsAt > defaults.startsAt).toBe(true);
      expect(localDatetimeFromNow(60)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });

  describe("validateEvent()", () => {
    test("recusa término anterior ao início em dia inteiro", () => {
      expect(validateEvent(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-11" }))).toBe(
        "A data de término deve ser posterior à data de início.",
      );
    });

    test("aceita o mesmo dia em dia inteiro — o evento dura o dia todo", () => {
      expect(validateEvent(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-12" }))).toBeNull();
    });

    test("recusa término igual ao início quando o evento tem hora", () => {
      expect(validateEvent(values({ startsAt: "2026-10-12T20:00", endsAt: "2026-10-12T20:00" }))).not.toBeNull();
    });
  });
});
