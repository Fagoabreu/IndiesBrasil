import { MEMBER_SUGGEST_MIN_LENGTH, normalizeMemberQuery } from "@/context/dataHooks/UseUserSuggest";

/**
 * Normalização do campo de convite do estúdio.
 *
 * O campo mostra `@username` porque é assim que as pessoas se referem a um
 * perfil aqui, mas o username gravado no banco não tem `@` — e o convite é
 * enviado por username (`POST /api/v1/studios/[slug]/invitations`). Enviar o
 * `@` fazia a API responder "usuário não encontrado" para um valor que estava
 * visivelmente certo na tela.
 */

describe("context/dataHooks/UseUserSuggest — normalizeMemberQuery()", () => {
  test("remove o `@` de exibição", () => {
    expect(normalizeMemberQuery("@fagoabreu")).toBe("fagoabreu");
    expect(normalizeMemberQuery("@fagoabreu ")).toBe("fagoabreu");
    expect(normalizeMemberQuery("  @fagoabreu  ")).toBe("fagoabreu");
  });

  test("aceita username sem `@`", () => {
    expect(normalizeMemberQuery("fagoabreu")).toBe("fagoabreu");
  });

  test("@ no meio do texto é parte do termo, não prefixo", () => {
    expect(normalizeMemberQuery("contato@estudio.dev")).toBe("contato@estudio.dev");
    expect(normalizeMemberQuery("@@a")).toBe("a");
  });

  test("entrada vazia ou inválida devolve string vazia", () => {
    expect(normalizeMemberQuery("")).toBe("");
    expect(normalizeMemberQuery("   ")).toBe("");
    expect(normalizeMemberQuery(null)).toBe("");
    expect(normalizeMemberQuery(undefined)).toBe("");
    expect(normalizeMemberQuery(42)).toBe("");
  });

  test("o termo mínimo evita buscar com uma letra", () => {
    // Uma letra casa com quase toda a base: seria uma varredura por tecla.
    expect(MEMBER_SUGGEST_MIN_LENGTH).toBe(2);
    expect(normalizeMemberQuery("@a")).toHaveLength(1);
  });
});
