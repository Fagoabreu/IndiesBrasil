import {
  STUDIO_ENTRY_KINDS,
  STUDIO_PRODUCT_TABS,
  HOW_TO_PUBLISH_PATH,
  canEditStudio,
  editableStudios,
  resolveStudioEntry,
  studioChooserHref,
} from "@/lib/studioEntry";

/**
 * Destino do botão "publicar" nas listagens.
 *
 * O defeito que isto evita: a listagem de jogos oferecia "Seja o primeiro a
 * cadastrar o seu jogo!" e nenhum caminho — e publicar exige um estúdio, que a
 * pessoa não tem como descobrir naquela tela. Aqui ficam os quatro estados da
 * sessão e o endereço de cada um; a tela só desenha o link.
 */
describe("lib/studioEntry.js", () => {
  test("visitante é mandado ao login e volta para a criação do estúdio", () => {
    const entry = resolveStudioEntry({ user: null });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.LOGIN);
    expect(entry.href).toContain("/login");
    expect(entry.href).toContain(encodeURIComponent("/estudios/novo"));
    expect(entry.label).toBe("Entrar para publicar");
  });

  test("sessão carregando não afirma nada: cai no mesmo destino do visitante", () => {
    const entry = resolveStudioEntry({ user: null, loadingUser: true });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.LOGIN);
  });

  test("logado sem estúdio é convidado a criar o seu", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: [] });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.CREATE);
    expect(entry.href).toBe("/estudios/novo");
    expect(entry.label).toBe("Criar meu estúdio");
  });

  /**
   * O bug que este caso fixa: `myStudios` começa nulo e só vira array quando
   * `/api/v1/studios?member=me` responde. Tratando `null` como "sem estúdio",
   * quem já tinha estúdio era mandado a `/estudios/novo` no primeiro instante da
   * página — e o botão "Oferecer serviços" caía na criação de um estúdio que já
   * existia.
   */
  test("lista de estúdios desconhecida NÃO vira 'sem estúdio'", () => {
    for (const studios of [null, undefined]) {
      const entry = resolveStudioEntry({ user: { id: "u1" }, studios });

      expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.PENDING);
      expect(entry.kind).not.toBe(STUDIO_ENTRY_KINDS.CREATE);
      expect(entry.href).toBe("/estudios?member=me");
    }
  });

  test("o destino de 'desconhecido' nunca é a criação de estúdio", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: null, tab: "services" });

    expect(entry.href).not.toBe("/estudios/novo");
    expect(entry.label).toBe("Meus estúdios");
  });

  test("logado com um estúdio vai direto à aba do tipo de conteúdo", () => {
    const entry = resolveStudioEntry({
      user: { id: "u1" },
      studios: [{ slug: "estudio-x", name: "Estúdio X" }],
      tab: "boardgames",
    });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.PUBLISH);
    expect(entry.href).toBe("/estudios/estudio-x/configuracoes?tab=boardgames");
    expect(entry.hint).toContain("Estúdio X");
  });

  test("com vários estúdios a escolha é da pessoa, não do código", () => {
    const entry = resolveStudioEntry({
      user: { id: "u1" },
      studios: [
        { slug: "a", name: "A", role: "owner" },
        { slug: "b", name: "B", role: "admin" },
      ],
      tab: "games",
    });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.CHOOSE);
    expect(entry.href).toBe("/estudios/escolher?tab=games");
    expect(entry.hint).toContain("2 estúdios");
  });

  /**
   * Admin de mais de um estúdio escolhe **antes** de abrir o formulário.
   *
   * O pedido que originou isto: com dois estúdios sob a mesma pessoa, o botão
   * "Oferecer serviços" abria um deles sem dizer qual — e a declaração ia para o
   * estúdio errado.
   */
  test("admin de vários estúdios passa pelo seletor, com a aba preservada", () => {
    const entry = resolveStudioEntry({
      user: { id: "u1" },
      studios: [
        { slug: "a", name: "A", role: "owner" },
        { slug: "b", name: "B", role: "admin" },
        { slug: "c", name: "C", role: "admin" },
      ],
      tab: "services",
    });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.CHOOSE);
    expect(entry.href).toBe("/estudios/escolher?tab=services");
  });

  test("membro comum não conta como estúdio editável", () => {
    // Um estúdio onde é admin e outro onde é só membro: vai direto ao que pode
    // editar, em vez de oferecer uma escolha que terminaria em 403.
    const entry = resolveStudioEntry({
      user: { id: "u1" },
      studios: [
        { slug: "meu", name: "Meu", role: "admin" },
        { slug: "deles", name: "Deles", role: "member" },
      ],
      tab: "services",
    });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.PUBLISH);
    expect(entry.href).toBe("/estudios/meu/configuracoes?tab=services");
  });

  test("só membro comum em todos: manda ao seletor, não à criação", () => {
    const entry = resolveStudioEntry({
      user: { id: "u1" },
      studios: [{ slug: "deles", name: "Deles", role: "member" }],
      tab: "services",
    });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.CHOOSE);
    expect(entry.href).toBe("/estudios/escolher?tab=services");
    expect(entry.href).not.toBe("/estudios/novo");
    expect(entry.hint).toContain("responsável ou administrador");
  });

  test("papel ausente conta como editável (payload antigo em cache)", () => {
    expect(canEditStudio({ slug: "s" })).toBe(true);
    expect(canEditStudio({ slug: "s", role: "owner" })).toBe(true);
    expect(canEditStudio({ slug: "s", role: "admin" })).toBe(true);
    expect(canEditStudio({ slug: "s", role: "member" })).toBe(false);
  });

  test("editableStudios ignora membro comum e tolera lista desconhecida", () => {
    expect(editableStudios(null)).toEqual([]);
    expect(
      editableStudios([
        { slug: "a", role: "admin" },
        { slug: "b", role: "member" },
      ]).map((studio) => studio.slug),
    ).toEqual(["a"]);
  });

  test("o endereço do seletor omite a aba quando não há uma", () => {
    expect(studioChooserHref()).toBe("/estudios/escolher");
    expect(studioChooserHref("services")).toBe("/estudios/escolher?tab=services");
    expect(studioChooserHref("inventada")).toBe("/estudios/escolher");
  });

  test("sem aba informada o destino é o painel do estúdio, sem query solta", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: [{ slug: "so-um" }] });

    expect(entry.href).toBe("/estudios/so-um/configuracoes");
  });

  test("aba desconhecida não vira query inventada", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: [{ slug: "s" }], tab: "inventada" });

    expect(entry.href).toBe("/estudios/s/configuracoes");
  });

  test("as abas cobrem os tipos publicáveis do estúdio", () => {
    expect(Object.keys(STUDIO_PRODUCT_TABS).sort()).toEqual(["assets", "boardgames", "books", "games", "services", "streaming"]);
  });

  test("a aba de serviços leva à declaração de serviços do estúdio", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: [{ slug: "estudio-a" }], tab: "services" });

    expect(entry.href).toBe("/estudios/estudio-a/configuracoes?tab=services");
  });

  test("a página de explicação é um endereço só", () => {
    expect(HOW_TO_PUBLISH_PATH).toBe("/como-publicar");
  });
});
