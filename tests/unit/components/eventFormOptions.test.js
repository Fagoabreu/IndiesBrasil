import { buildEventPayload, emptyEventValues, eventValuesFromApi, localDatetimeFromNow, validateEvent } from "@/components/Agenda/eventFormOptions";

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
    test("dia inteiro: o dia escolhido vira a meia-noite de Brasília", () => {
      const payload = buildEventPayload(values({ isAllDay: true, startsAt: "2026-10-12", endsAt: "2026-10-12" }), { mode: "create" });

      // Era "2026-10-12T00:00:00.000Z" — 21h do dia 11 em Brasília.
      expect(payload.starts_at).toBe("2026-10-12T03:00:00.000Z");
      // O término vai como o dia **escolhido**; o fim exclusivo (00:00 do dia
      // seguinte) é derivado no servidor, onde a regra vale para todo cliente.
      expect(payload.ends_at).toBe("2026-10-12T03:00:00.000Z");
      expect(payload.is_all_day).toBe(true);
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
      expect(um.ends_at).toBe("2026-10-14T03:00:00.000Z");
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
      // igual no payload. Se a leitura devolvesse o dia do fim exclusivo, cada
      // save empurraria o evento.
      const api = { title: "Jam", is_all_day: true, starts_at: "2026-10-12T03:00:00.000Z", ends_at: "2026-10-13T03:00:00.000Z" };

      const form = eventValuesFromApi(api);
      const payload = buildEventPayload(form, { mode: "edit" });

      expect(payload.starts_at).toBe(api.starts_at);
      expect(payload.ends_at).toBe(api.starts_at);
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
