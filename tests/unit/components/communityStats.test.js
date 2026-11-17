import { renderToStaticMarkup } from "react-dom/server";
import CommunityStats from "@/components/Landing/CommunityStats/CommunityStats";

/**
 * Faixa de números da home.
 *
 * O que motivou o teste: `GET /api/v1/status/summary` devolve as contagens como
 * **string** (`"3"`), porque são `bigint` no Postgres. A primeira versão
 * comparava com `Number.isFinite` e a faixa simplesmente nunca aparecia — sem
 * erro no servidor, sem erro no console. O teste fixa a conversão, o plural, e
 * o comportamento na ausência de dado.
 */
const SUMMARY = { games: "1", organizations: "2", user_accounts: "3", events: "0" };

function render(props) {
  return renderToStaticMarkup(<CommunityStats summary={SUMMARY} state="ready" {...props} />);
}

describe("components/Landing/CommunityStats", () => {
  test("lê as contagens em string, com singular e plural", () => {
    const html = render({});

    expect(html).toContain("1</strong> jogo");
    expect(html).toContain("2</strong> estúdios");
    expect(html).toContain("3</strong> membros");
  });

  test("cada número leva à sua listagem", () => {
    const html = render({});

    expect(html).toContain('href="/jogos"');
    expect(html).toContain('href="/estudios"');
    expect(html).toContain('href="/membros"');
  });

  test("categoria zerada não aparece", () => {
    const html = render({});

    expect(html).not.toContain("evento");
  });

  test("sem número não há faixa — nem carregando, nem com erro", () => {
    expect(renderToStaticMarkup(<CommunityStats summary={null} state="loading" />)).toBe("");
    expect(renderToStaticMarkup(<CommunityStats summary={null} state="error" />)).toBe("");
  });
});
