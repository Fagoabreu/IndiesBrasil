import {
  EVENT_WEEKDAYS,
  allDayEndDate,
  allDayEndInstant,
  allDayLastInstant,
  allDayStartInstant,
  brasiliaMonthRange,
  eventCivilDate,
  eventCivilDayDiff,
  eventDateParts,
  eventInstantOf,
  formatEventDate,
  formatEventShortDate,
  instantToWallClock,
  shiftEventDays,
  wallClockToInstant,
} from "@/lib/eventFormat";

/**
 * Conversão de data/hora dos eventos.
 *
 * O caso que originou o arquivo: o valor de `<input type="date">` era gravado em
 * `new Date(...)`, que a especificação manda ler como **meia-noite UTC** — 21h
 * do dia anterior em Brasília. O evento de dia inteiro aparecia com o dia
 * anterior no card da agenda e da home.
 *
 * Os testes rodam no fuso do runner (o do container, UTC), e **este é o ponto**:
 * a saída não pode depender dele. Se algum helper voltasse a usar `getDate()` ou
 * `toISOString()`, o resultado mudaria conforme a máquina.
 */

// 12/10/2026 é uma segunda-feira.
const SEGUNDA = 1;

describe("lib/eventFormat.js", () => {
  describe("wallClockToInstant()", () => {
    test("data-only do input de dia inteiro vira 00:00 de Brasília", () => {
      expect(wallClockToInstant("2026-10-12").toISOString()).toBe("2026-10-12T03:00:00.000Z");
    });

    test("datetime-local é lido como hora de Brasília", () => {
      expect(wallClockToInstant("2026-10-12T20:00").toISOString()).toBe("2026-10-12T23:00:00.000Z");
    });

    test("horário que cruza a meia-noite UTC continua no mesmo dia de Brasília", () => {
      // 22:00 em Brasília é 01:00Z do dia seguinte — o caso em que "dia" e
      // "horário" discordavam na agenda antiga.
      expect(wallClockToInstant("2026-10-12T22:00").toISOString()).toBe("2026-10-13T01:00:00.000Z");
    });

    test("string com offset já é instante e passa intacta", () => {
      // As expressões de data-only/datetime-local são ancoradas: sem isso um
      // instante resolvido seria reinterpretado como hora de parede.
      expect(wallClockToInstant("2026-10-12T20:00:30Z").toISOString()).toBe("2026-10-12T20:00:30.000Z");
      expect(wallClockToInstant("2026-10-12T20:00:00-03:00").toISOString()).toBe("2026-10-12T23:00:00.000Z");
    });

    test("não assume o fuso corrente: o deslocamento é do instante", () => {
      // 04/11/2018 foi o primeiro dia do horário de verão (UTC-2). O offset fixo
      // em -03:00 erraria esta data por uma hora.
      expect(wallClockToInstant("2018-11-03T12:00").toISOString()).toBe("2018-11-03T15:00:00.000Z");
      expect(wallClockToInstant("2018-11-04T12:00").toISOString()).toBe("2018-11-04T14:00:00.000Z");
    });

    test("recusa data inválida em vez de gravar um instante inválido", () => {
      expect(() => wallClockToInstant("ontem")).toThrow(RangeError);
    });
  });

  describe("instantToWallClock()", () => {
    test("formata para datetime-local na hora de Brasília", () => {
      expect(instantToWallClock("2026-10-12T23:00:00.000Z")).toBe("2026-10-12T20:00");
    });

    test("aceita Date e número", () => {
      const instant = new Date("2026-10-13T01:00:00.000Z");
      expect(instantToWallClock(instant)).toBe("2026-10-12T22:00");
      expect(instantToWallClock(instant.getTime())).toBe("2026-10-12T22:00");
    });

    test("dateOnly devolve o formato do input de dia inteiro", () => {
      expect(instantToWallClock("2026-10-12T03:00:00.000Z", { dateOnly: true })).toBe("2026-10-12");
    });

    test("valor ausente ou inválido não vira data de mentira", () => {
      expect(instantToWallClock(null)).toBe("");
      expect(instantToWallClock("")).toBe("");
      expect(instantToWallClock("data-invalida")).toBe("");
    });
  });

  describe("dia inteiro", () => {
    test("o início é a meia-noite de Brasília do dia escolhido", () => {
      expect(allDayStartInstant("2026-10-12").toISOString()).toBe("2026-10-12T03:00:00.000Z");
    });

    test("o término é a meia-noite de Brasília do dia seguinte (fim exclusivo)", () => {
      expect(allDayEndInstant("2026-10-12").toISOString()).toBe("2026-10-13T03:00:00.000Z");
    });

    test("normalizar de novo não anda um dia — é o que mantém o PATCH estável", () => {
      const exclusiveEnd = allDayEndInstant("2026-10-12");
      expect(allDayEndInstant(exclusiveEnd).toISOString()).toBe("2026-10-13T03:00:00.000Z");
      expect(allDayStartInstant(allDayStartInstant("2026-10-12")).toISOString()).toBe("2026-10-12T03:00:00.000Z");
    });

    test("o último dia incluído é o dia escolhido, não o instante do término", () => {
      const endsAt = allDayEndInstant("2026-10-12");
      expect(allDayEndDate(endsAt)).toBe("2026-10-12");
      expect(allDayLastInstant(endsAt).toISOString()).toBe("2026-10-13T02:59:59.999Z");
    });

    test("evento de vários dias cobre o intervalo inteiro", () => {
      // 12 a 14/out inclusivos: 3 dias.
      const startsAt = allDayStartInstant("2026-10-12");
      const endsAt = allDayEndInstant("2026-10-14");

      expect(endsAt.toISOString()).toBe("2026-10-15T03:00:00.000Z");
      expect(allDayEndDate(endsAt)).toBe("2026-10-14");
      expect((endsAt - startsAt) / 3600000).toBe(72);
    });

    test("o dia inteiro do dia 1º entra na lista do próprio mês", () => {
      // Duração zero deixava `ei.ends_at > from` falso para o primeiro dia.
      const { from, to } = brasiliaMonthRange(2026, 9);
      const startsAt = allDayStartInstant("2026-10-01");
      const endsAt = allDayEndInstant("2026-10-01");

      expect(startsAt < to).toBe(true);
      expect(endsAt > from).toBe(true);
    });
  });

  describe("brasiliaMonthRange()", () => {
    test("cobre o mês de Brasília, com término exclusivo", () => {
      const { from, to } = brasiliaMonthRange(2026, 9);

      expect(from.toISOString()).toBe("2026-10-01T03:00:00.000Z");
      expect(to.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    });

    test("vira o ano no último mês", () => {
      const { from, to } = brasiliaMonthRange(2026, 11);

      expect(from.toISOString()).toBe("2026-12-01T03:00:00.000Z");
      expect(to.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    });
  });

  describe("eventDateParts()", () => {
    test("devolve o dia de Brasília, com o mês 0-indexado e o dia da semana", () => {
      const parts = eventDateParts("2026-10-12T23:00:00.000Z");

      expect(parts).toEqual({ weekday: SEGUNDA, day: 12, month: 9, year: 2026, time: "20:00" });
      expect(EVENT_WEEKDAYS[parts.weekday]).toBe("Seg");
    });

    test("o dia anterior não aparece para a meia-noite de Brasília", () => {
      expect(eventDateParts("2026-10-12T03:00:00.000Z").day).toBe(12);
    });
  });

  describe("formatação", () => {
    test("formatEventDate() mostra a hora só quando o evento tem hora", () => {
      expect(formatEventDate("2026-10-12T23:00:00.000Z")).toBe("Seg, 12 de out de 2026 às 20:00");
      expect(formatEventDate("2026-10-12T03:00:00.000Z", { allDay: true })).toBe("Seg, 12 de out de 2026");
    });

    test("formatEventShortDate() é a data curta da lista de ocorrências", () => {
      expect(formatEventShortDate("2026-10-12T03:00:00.000Z")).toBe("Seg, 12/out/2026");
    });
  });

  describe("aritmética de calendário", () => {
    test("shiftEventDays() vira mês e ano", () => {
      expect(shiftEventDays({ year: 2026, month: 10, day: 31 }, 1)).toMatchObject({ year: 2026, month: 11, day: 1 });
      expect(shiftEventDays({ year: 2026, month: 12, day: 31 }, 1)).toMatchObject({ year: 2027, month: 1, day: 1 });
      expect(shiftEventDays({ year: 2026, month: 1, day: 1 }, -1)).toMatchObject({ year: 2025, month: 12, day: 31 });
    });

    test("shiftEventDays() preserva o horário de parede", () => {
      expect(shiftEventDays({ year: 2026, month: 10, day: 12, hour: 20, minute: 30 }, 7)).toMatchObject({
        day: 19,
        hour: 20,
        minute: 30,
      });
    });

    test("shiftEventDays() recalcula o dia da semana", () => {
      expect(shiftEventDays({ year: 2026, month: 10, day: 12 }, 1).weekday).toBe(2);
    });

    test("eventCivilDayDiff() conta dias civis, não horas", () => {
      const primeiro = eventCivilDate("2026-10-12T03:00:00.000Z");
      // 23:59:59.999 de Brasília no dia 12 é 02:59:59.999Z do dia 13: a diferença
      // em horas seria ~24h, e em dias civis é 0.
      const ultimo = eventCivilDate("2026-10-13T02:59:59.999Z");

      expect(eventCivilDayDiff(primeiro, ultimo)).toBe(0);
      expect(eventCivilDayDiff(primeiro, shiftEventDays(primeiro, 3))).toBe(3);
    });

    test("eventInstantOf() sem hora é meia-noite", () => {
      expect(eventInstantOf({ year: 2026, month: 10, day: 12 }).toISOString()).toBe("2026-10-12T03:00:00.000Z");
    });
  });
});
