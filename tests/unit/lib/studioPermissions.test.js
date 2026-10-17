import { canRemoveMember } from "@/lib/studioPermissions";

/**
 * Remoção de membro do estúdio — o caso do responsável.
 *
 * O que originou o teste: `canRemoveMember` devolvia `true` para "sair por conta
 * própria" **antes** de olhar o papel do alvo, então o dono conseguia se
 * remover. A rota já recusava antes de chamar a função, mas a matriz é a
 * invariante que vale para todo caminho de escrita — uma rota nova, um script
 * ou uma chamada direta ao model passariam por cima da checagem da rota.
 *
 * O estado que isso criava não é "usuário saiu": `organizations.owner_id` é
 * `NOT NULL` e continua apontando para ele, enquanto `org_members` e
 * `org_roles` somem. O estúdio fica sem ninguém que possa administrá-lo,
 * transferi-lo ou excluí-lo.
 */

describe("lib/studioPermissions.js — canRemoveMember()", () => {
  test("o responsável não sai do estúdio, nem por mão própria", () => {
    expect(canRemoveMember("owner", "owner", true)).toBe(false);
    // Outro papel tentando remover o responsável também é recusado.
    expect(canRemoveMember("admin", "owner", false)).toBe(false);
    expect(canRemoveMember("member", "owner", false)).toBe(false);
  });

  test("membro comum pode sair por conta própria", () => {
    expect(canRemoveMember("member", "member", true)).toBe(true);
  });

  test("admin pode sair por conta própria", () => {
    expect(canRemoveMember("admin", "admin", true)).toBe(true);
  });

  test("remover um admin exige ser o responsável", () => {
    expect(canRemoveMember("owner", "admin", false)).toBe(true);
    expect(canRemoveMember("admin", "admin", false)).toBe(false);
  });

  test("admin e responsável removem membros comuns", () => {
    expect(canRemoveMember("owner", "member", false)).toBe(true);
    expect(canRemoveMember("admin", "member", false)).toBe(true);
    expect(canRemoveMember("member", "member", false)).toBe(false);
    expect(canRemoveMember(null, "member", false)).toBe(false);
  });
});
