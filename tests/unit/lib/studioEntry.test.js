import { STUDIO_ENTRY_KINDS, STUDIO_PRODUCT_TABS, HOW_TO_PUBLISH_PATH, resolveStudioEntry } from "@/lib/studioEntry";

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
        { slug: "a", name: "A" },
        { slug: "b", name: "B" },
      ],
      tab: "games",
    });

    expect(entry.kind).toBe(STUDIO_ENTRY_KINDS.CHOOSE);
    expect(entry.href).toBe("/estudios?tab=member");
  });

  test("sem aba informada o destino é o painel do estúdio, sem query solta", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: [{ slug: "so-um" }] });

    expect(entry.href).toBe("/estudios/so-um/configuracoes");
  });

  test("aba desconhecida não vira query inventada", () => {
    const entry = resolveStudioEntry({ user: { id: "u1" }, studios: [{ slug: "s" }], tab: "inventada" });

    expect(entry.href).toBe("/estudios/s/configuracoes");
  });

  test("as abas cobrem os cinco tipos publicáveis do estúdio", () => {
    expect(Object.keys(STUDIO_PRODUCT_TABS).sort()).toEqual(["assets", "boardgames", "books", "games", "streaming"]);
  });

  test("a página de explicação é um endereço só", () => {
    expect(HOW_TO_PUBLISH_PATH).toBe("/como-publicar");
  });
});
