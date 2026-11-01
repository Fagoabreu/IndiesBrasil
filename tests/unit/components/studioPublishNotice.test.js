import { renderToStaticMarkup } from "react-dom/server";
import StudioPublishNotice from "@/components/Studio/StudioPublishNotice/StudioPublishNotice";

/**
 * Aviso de publicação dentro das listagens.
 *
 * O defeito que ele corrige não é visual: era possível percorrer `/jogos`,
 * `/quadrinhos` e `/assets` inteiros sem descobrir que publicar exige um
 * estúdio. O teste fixa as duas coisas que fazem a explicação funcionar — o
 * texto existe nas duas variantes e o botão aponta para um endereço real (não
 * `#`), porque convite sem destino é o que já havia antes ("Seja o primeiro a
 * cadastrar o seu jogo!").
 */

const mockUser = { user: null, loadingUser: false, myStudios: [] };

jest.mock("../../../context/UserContext", () => ({
  useUser: () => globalThis.__mockUserState,
}));

beforeEach(() => {
  globalThis.__mockUserState = { ...mockUser };
});

function render(props = {}) {
  return renderToStaticMarkup(<StudioPublishNotice {...props} />);
}

describe("components/Studio/StudioPublishNotice", () => {
  test("a faixa explica o modelo de estúdio", () => {
    const html = render({ tab: "games" });

    expect(html).toContain("Publicar aqui exige um estúdio");
    expect(html).toContain("publicados por um estúdio");
  });

  test("o estado vazio é instrução, não convite sem destino", () => {
    const html = render({ tab: "games", variant: "empty" });

    expect(html).toContain("Tudo aqui é publicado por um estúdio");
    expect(html).toContain("Como funciona");
  });

  test("visitante recebe o login como destino", () => {
    const html = render({ tab: "books" });

    expect(html).toContain("Entrar para publicar");
    expect(html).toContain("/login");
  });

  test("conta sem estúdio é levada a criar um", () => {
    globalThis.__mockUserState = { user: { id: "u1" }, loadingUser: false, myStudios: [] };

    const html = render({ tab: "games" });

    expect(html).toContain("Criar meu estúdio");
    expect(html).toContain("/estudios/novo");
  });

  test("com um estúdio, o destino é a aba do tipo de conteúdo", () => {
    globalThis.__mockUserState = {
      user: { id: "u1" },
      loadingUser: false,
      myStudios: [{ slug: "estudio-a", name: "Estúdio A" }],
    };

    const html = render({ tab: "boardgames" });

    expect(html).toContain("Publicar no meu estúdio");
    expect(html).toContain("/estudios/estudio-a/configuracoes?tab=boardgames");
  });

  test("com vários estúdios, quem escolhe é a pessoa", () => {
    globalThis.__mockUserState = {
      user: { id: "u1" },
      loadingUser: false,
      myStudios: [
        { slug: "a", name: "A" },
        { slug: "b", name: "B" },
      ],
    };

    const html = render({ tab: "assets" });

    expect(html).toContain("Escolher estúdio");
    expect(html).toContain("/estudios?tab=member");
  });

  test("as duas variantes linkam a página de explicação", () => {
    expect(render({ tab: "games" })).toContain("/como-publicar");
    expect(render({ tab: "games", variant: "empty" })).toContain("/como-publicar");
  });
});
