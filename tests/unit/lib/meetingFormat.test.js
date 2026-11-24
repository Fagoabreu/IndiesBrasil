import {
  defaultMeetingWindow,
  formatDateTimeBR,
  formatMeetingRange,
  getMeetingPhase,
  getMeetingPhaseLabel,
  meetingInputToInstant,
  toMeetingInputValue,
} from "@/lib/meetingFormat";

/**
 * Testes unitários dos helpers de formatação/fase de reuniões (Fase 4).
 * Não dependem de servidor/banco.
 */

// 12/03/2025 14:30 UTC-3 (horário de Brasília)
const STARTS = "2025-03-12T14:30:00-03:00";
// 12/03/2025 15:30 UTC-3
const ENDS = "2025-03-12T15:30:00-03:00";

describe("lib/meetingFormat.js", () => {
  describe("toMeetingInputValue()", () => {
    test("converte instante para o valor do input no fuso de Brasília", () => {
      // Independe do TZ do runner (CI roda em UTC): o valor é sempre 14:30.
      expect(toMeetingInputValue(STARTS)).toBe("2025-03-12T14:30");
    });

    test("retorna vazio para data inválida", () => {
      expect(toMeetingInputValue("data-invalida")).toBe("");
    });
  });

  describe("meetingInputToInstant()", () => {
    test("lê o valor do input como hora de Brasília, não do navegador", () => {
      expect(meetingInputToInstant("2026-03-12T14:30").toISOString()).toBe("2026-03-12T17:30:00.000Z");
    });

    test("ida e volta preserva o horário digitado", () => {
      const instant = meetingInputToInstant("2026-03-12T09:05");
      expect(toMeetingInputValue(instant)).toBe("2026-03-12T09:05");
    });
  });

  describe("defaultMeetingWindow()", () => {
    test("início é a hora atual (Brasília) e término é uma hora depois", () => {
      // 2026-11-24T01:46Z = 22:46 de 23/11 em Brasília (UTC-3).
      const window = defaultMeetingWindow(Date.parse("2026-11-24T01:46:00Z"));

      expect(window.startsAt).toBe("2026-11-23T22:46");
      expect(window.endsAt).toBe("2026-11-23T23:46");
    });

    test("virada de dia no término", () => {
      // 2026-11-24T02:40Z = 23:40 de 23/11 em Brasília → término 00:40 do dia seguinte.
      const window = defaultMeetingWindow(Date.parse("2026-11-24T02:40:00Z"));

      expect(window.startsAt).toBe("2026-11-23T23:40");
      expect(window.endsAt).toBe("2026-11-24T00:40");
    });
  });

  describe("formatDateTimeBR()", () => {
    test("formata data/hora em pt-BR", () => {
      expect(formatDateTimeBR(STARTS)).toBe("12/03/2025 14:30");
    });

    test("retorna vazio para valor ausente", () => {
      expect(formatDateTimeBR(null)).toBe("");
      expect(formatDateTimeBR("")).toBe("");
    });
  });

  describe("formatMeetingRange()", () => {
    test("mesmo dia: mostra data única e faixa de horários", () => {
      expect(formatMeetingRange(STARTS, ENDS)).toBe("12/03/2025, 14:30 → 15:30");
    });

    test("dias diferentes: mostra as duas datas completas", () => {
      const nextDay = "2025-03-13T10:00:00-03:00";
      expect(formatMeetingRange(STARTS, nextDay)).toBe("12/03/2025 14:30 → 13/03/2025 10:00");
    });

    test("retorna vazio sem datas", () => {
      expect(formatMeetingRange(null, null)).toBe("");
    });
  });

  describe("getMeetingPhase()", () => {
    test("reunião cancelada tem precedência", () => {
      const meeting = { status: "cancelled", starts_at: STARTS, ends_at: ENDS };
      expect(getMeetingPhase(meeting, new Date(STARTS).getTime())).toBe("cancelled");
    });

    test("status encerrada é respeitado", () => {
      const meeting = { status: "ended", starts_at: STARTS, ends_at: ENDS };
      expect(getMeetingPhase(meeting, new Date(STARTS).getTime())).toBe("ended");
    });

    test("antes do início => agendada", () => {
      const meeting = { status: "scheduled", starts_at: STARTS, ends_at: ENDS };
      const beforeStart = new Date(STARTS).getTime() - 60_000;
      expect(getMeetingPhase(meeting, beforeStart)).toBe("scheduled");
    });

    test("dentro da janela => ao vivo", () => {
      const meeting = { status: "scheduled", starts_at: STARTS, ends_at: ENDS };
      const inside = new Date(STARTS).getTime() + 30 * 60_000;
      expect(getMeetingPhase(meeting, inside)).toBe("live");
    });

    test("após o término (sem status) => encerrada", () => {
      const meeting = { status: "scheduled", starts_at: STARTS, ends_at: ENDS };
      const afterEnd = new Date(ENDS).getTime() + 60_000;
      expect(getMeetingPhase(meeting, afterEnd)).toBe("ended");
    });
  });

  describe("getMeetingPhaseLabel()", () => {
    test("retorna labels em pt-BR", () => {
      const meeting = { status: "scheduled", starts_at: STARTS, ends_at: ENDS };
      expect(getMeetingPhaseLabel(meeting, new Date(STARTS).getTime() + 30 * 60_000)).toBe("Ao vivo");
      expect(getMeetingPhaseLabel({ ...meeting, status: "cancelled" }, Date.now())).toBe("Cancelada");
    });
  });
});
