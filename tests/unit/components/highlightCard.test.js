import { renderToStaticMarkup } from "react-dom/server";
import HighlightCard from "@/components/HighlightCard/HighlightCard";

/**
 * Capa de livro pode vir de **host externo** (`cover_url_external`).
 *
 * O `next/image` recusa host fora de `images.remotePatterns` e, no servidor,
 * esse erro vira **500 na home inteira** — foi o teste de integração
 * `pages/home.test.js` quem pegou. No Jest a validação de host não roda (o
 * `next/image` só recebe as opções do bundler no build), então o que este
 * arquivo fixa é a **saída do componente**: capa externa é desenhada com a URL
 * crua (`unoptimized`), capa do nosso storage continua passando pelo otimizador
 * (`/_next/image?url=`). Sem essa diferença, volta o 500.
 */
const EXTERNAL_COVER = "https://example.com/capa.jpg";
const STORAGE_COVER = "https://res.cloudinary.com/demo/image/upload/jogo.jpg";

function item(overrides = {}) {
  return {
    type: "book",
    name: "Livro em destaque",
    slug: "livro-em-destaque",
    short_description: "Resumo do livro.",
    ...overrides,
  };
}

describe("components/HighlightCard", () => {
  test("capa em host externo não passa pelo otimizador", () => {
    const html = renderToStaticMarkup(<HighlightCard item={item({ banner_url: EXTERNAL_COVER })} />);

    expect(html).toContain('href="/quadrinhos/livro-em-destaque"');
    expect(html).toContain(`src="${EXTERNAL_COVER}"`);
    expect(html).not.toContain("/_next/image?url=");
  });

  test("capa do nosso storage continua otimizada", () => {
    const html = renderToStaticMarkup(<HighlightCard item={item({ type: "game", banner_url: STORAGE_COVER })} />);

    expect(html).toContain('href="/jogos/livro-em-destaque"');
    expect(html).toContain("/_next/image?url=");
  });

  test("sem capa, desenha o placeholder com a inicial", () => {
    const html = renderToStaticMarkup(<HighlightCard item={item()} />);

    expect(html).not.toContain("<img");
    expect(html).toContain("L");
  });
});
