import { formatDateTimeBR, formatMeetingRange, getMeetingPhase, getMeetingPhaseLabel, toLocalDatetimeValue } from "@/lib/meetingFormat";

/**
 * Testes unitários dos helpers de formatação/fase de reuniões (Fase 4).
 * Não dependem de servidor/banco.
 */

// 12/03/2025 14:30 UTC-3 (horário de Brasília)
const STARTS = "2025-03-12T14:30:00-03:00";
// 12/03/2025 15:30 UTC-3
const ENDS = "2025-03-12T15:30:00-03:00";

describe("lib/meetingFormat.js", () => {
  describe("toLocalDatetimeValue()", () => {
    test("formata para input datetime-local (AAAA-MM-DDTHH:mm)", () => {
      const value = toLocalDatetimeValue(STARTS);
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test("retorna vazio para data inválida", () => {
      expect(toLocalDatetimeValue("data-invalida")).toBe("");
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
