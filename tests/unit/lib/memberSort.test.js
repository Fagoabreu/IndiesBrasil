import { DEFAULT_MEMBER_SORT, MEMBER_SORT_FIELDS, MEMBER_SORT_OPTIONS, MEMBER_SORT_ORDERS, memberSortValue, parseMemberSort } from "@/lib/memberSort";

/**
 * Ordenação do diretório de membros.
 *
 * Duas garantias importam aqui, e as duas falhariam em silêncio:
 *
 * 1. **O padrão não muda.** A leitura de sempre é "mais recentes"; se o padrão
 *    virasse outro, quem abre `/membros` veria uma lista diferente sem ter
 *    pedido nada (e o cursor antigo, que é `created_at|id`, deixaria de valer).
 * 2. **O seletor e a API falam as mesmas chaves.** Uma opção na tela que a rota
 *    recusa vira 400 na cara do usuário; uma chave aceita pela API que a tela
 *    não oferece é funcionalidade que ninguém descobre.
 */

describe("lib/memberSort.js", () => {
  test("o padrão é mais recentes — a leitura que a página sempre teve", () => {
    expect(DEFAULT_MEMBER_SORT).toEqual({ field: "created_at", order: "desc" });
  });

  test("toda opção do seletor é uma combinação válida de campo e ordem", () => {
    expect(MEMBER_SORT_OPTIONS.length).toBeGreaterThan(0);

    for (const option of MEMBER_SORT_OPTIONS) {
      expect(MEMBER_SORT_FIELDS).toContain(option.field);
      expect(MEMBER_SORT_ORDERS).toContain(option.order);
      expect(typeof option.label).toBe("string");
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  test("cada critério aparece nos dois sentidos", () => {
    // O pedido é explícito: "do menor para o maior quanto do maior para o menor".
    for (const field of MEMBER_SORT_FIELDS) {
      const orders = MEMBER_SORT_OPTIONS.filter((option) => option.field === field).map((option) => option.order);
      expect(orders.sort()).toEqual(["asc", "desc"]);
    }
  });

  test("o valor do seletor é `campo:ordem`", () => {
    expect(memberSortValue({ field: "reputation", order: "asc" })).toBe("reputation:asc");
    expect(memberSortValue(DEFAULT_MEMBER_SORT)).toBe("created_at:desc");
  });

  describe("parseMemberSort()", () => {
    test("parâmetros separados (formato da API)", () => {
      expect(parseMemberSort("reputation", "desc")).toEqual({ field: "reputation", order: "desc" });
      expect(parseMemberSort("followers", "asc")).toEqual({ field: "followers", order: "asc" });
      expect(parseMemberSort("created_at", "asc")).toEqual({ field: "created_at", order: "asc" });
    });

    test("valor composto (formato do seletor)", () => {
      expect(parseMemberSort("reputation:asc")).toEqual({ field: "reputation", order: "asc" });
    });

    test("campo sem direção assume desc", () => {
      expect(parseMemberSort("followers")).toEqual({ field: "followers", order: "desc" });
    });

    test("ausente devolve null — quem chama decide o padrão", () => {
      expect(parseMemberSort(undefined, undefined)).toBeNull();
      expect(parseMemberSort("", "")).toBeNull();
    });

    test("valor desconhecido é recusado, não convertido em padrão", () => {
      // `?sort=reputacao` (com ç) caindo em "mais recentes" faria o erro passar
      // como se estivesse tudo certo.
      expect(parseMemberSort("reputacao", "desc")).toBeNull();
      expect(parseMemberSort("reputation", "crescente")).toBeNull();
      expect(parseMemberSort("reputation:lado")).toBeNull();
      expect(parseMemberSort(null, "desc")).toBeNull();
    });
  });
});
