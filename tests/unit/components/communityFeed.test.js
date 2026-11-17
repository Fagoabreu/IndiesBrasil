import { renderToStaticMarkup } from "react-dom/server";
import CommunityFeed from "@/components/Landing/CommunityFeed/CommunityFeed";

/**
 * Prévia do feed na home.
 *
 * O que motivou: a página se anuncia como rede social e não mostrava nenhum
 * post. O componente é só de leitura — link para `/posts/<id>`, autor, trecho e
 * reações —, e precisa continuar assim: nada de curtir/comentar aqui.
 */
function post(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    content: "Terminei o protótipo do combate e liberei a build para testar.",
    created_at: "2026-11-17T12:00:00.000Z",
    author_username: "estudioaurora",
    likes_count: "3",
    comments_count: "1",
    ...overrides,
  };
}

describe("components/Landing/CommunityFeed", () => {
  test("cada post vira um link para o feed", () => {
    const html = renderToStaticMarkup(<CommunityFeed posts={[post()]} />);

    expect(html).toContain('href="/posts/11111111-1111-4111-8111-111111111111"');
    expect(html).toContain("@estudioaurora");
    expect(html).toContain("Terminei o protótipo do combate");
  });

  test("conta reações e usa singular", () => {
    const html = renderToStaticMarkup(<CommunityFeed posts={[post()]} />);

    expect(html).toContain("3 curtidas");
    expect(html).toContain("1 comentário");
  });

  test("zero curtida/comentário não aparece", () => {
    const html = renderToStaticMarkup(<CommunityFeed posts={[post({ likes_count: "0", comments_count: 0 })]} />);

    expect(html).not.toContain("curtida");
    expect(html).not.toContain("comentário");
  });

  test("texto longo é cortado, sem quebrar linha", () => {
    const html = renderToStaticMarkup(<CommunityFeed posts={[post({ content: `${"a".repeat(400)}\n\nfim` })]} />);

    expect(html).toContain("…");
    expect(html).not.toContain("fim");
  });

  test("sem posts, a seção não existe", () => {
    expect(renderToStaticMarkup(<CommunityFeed posts={[]} />)).toBe("");
  });
});
