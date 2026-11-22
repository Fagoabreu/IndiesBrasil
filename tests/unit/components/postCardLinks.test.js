import { renderToStaticMarkup } from "react-dom/server";
import PostCardComponent from "@/components/PostCard/PostCardComponent";

/**
 * Links do card.
 *
 * Duas regressões que já aconteceram e voltam fácil:
 *
 *  1. O badge do evento preferia `event_slug`. `/agenda/[id]` valida UUID e
 *     responde 404 para slug — todo post com slug levava a "página não
 *     encontrada". O endereço canônico do evento é o **id**, como em
 *     `EventCard` e no sitemap.
 *  2. A página do evento precisa de um caminho explícito para o post; o card
 *     não pode ser um link inteiro (tem links de autor/evento e botões dentro).
 */
const basePost = {
  id: 7,
  content: "Conteúdo do post",
  author_username: "autora",
  created_at: new Date().toISOString(),
  likes_count: 0,
  comments_count: 0,
};

describe("components/PostCard — links", () => {
  test("badge do evento usa o id, mesmo quando existe slug", () => {
    const html = renderToStaticMarkup(
      <PostCardComponent
        post={{ ...basePost, event_id: "11111111-1111-4111-8111-111111111111", event_slug: "evento-bonito", event_title: "Evento bonito" }}
      />,
    );

    expect(html).toContain('href="/agenda/11111111-1111-4111-8111-111111111111"');
    expect(html).not.toContain("/agenda/evento-bonito");
  });

  test("showPermalink aponta para a página do post", () => {
    const html = renderToStaticMarkup(<PostCardComponent post={basePost} showPermalink />);

    expect(html).toContain('href="/posts/7"');
    expect(html).toContain("Ver post completo");
  });

  test("sem showPermalink o feed não ganha link extra", () => {
    const html = renderToStaticMarkup(<PostCardComponent post={basePost} />);

    expect(html).not.toContain('href="/posts/7"');
  });
});
