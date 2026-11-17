import { renderToStaticMarkup } from "react-dom/server";
import GooglePlayCard from "@/components/StoreLinks/GooglePlayCard";

/**
 * Card da loja sem widget (Google Play).
 *
 * O que o teste fixa é o estado que a produção vai ver mais vezes: **sem**
 * preview. A Play bloqueia IP de datacenter (429) com frequência, e o card
 * precisa continuar completo — nome do jogo, chamada e destino canônico — porque
 * antes dele a seção "Onde comprar" mostrava só "Visitar loja ↗".
 *
 * Não há teste do estado enriquecido: ele depende de `useEffect`, que não roda em
 * `renderToStaticMarkup`, e a regra de extração já é coberta por
 * `tests/unit/lib/storeLinks.test.js`.
 */

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.company.mergeisland&hl=pt_BR&gl=BR";

function render(props) {
  return renderToStaticMarkup(<GooglePlayCard {...props} />);
}

describe("components/StoreLinks/GooglePlayCard", () => {
  test("sem preview, mostra o nome do jogo e a chamada da loja", () => {
    const html = render({ url: PLAY_URL, gameName: "Merge Island" });

    expect(html).toContain("Merge Island");
    expect(html).toContain("Ver no Google Play");
    expect(html).not.toContain("Visitar loja");
  });

  test("o destino é canônico, derivado do id do pacote", () => {
    const html = render({ url: PLAY_URL, gameName: "Merge Island" });

    expect(html).toContain('href="https://play.google.com/store/apps/details?id=com.company.mergeisland"');
    // `hl`/`gl` do botão de compartilhar não vão para o card.
    expect(html).not.toContain("hl=pt_BR");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("sem nome de jogo, o card não fica sem título", () => {
    const html = render({ url: PLAY_URL });

    expect(html).toContain("Google Play");
  });

  test("URL que não é ficha de app ainda abre o link cadastrado", () => {
    const html = render({ url: "https://play.google.com/store/search?q=merge%20island", gameName: "Merge Island" });

    expect(html).toContain('href="https://play.google.com/store/search?q=merge%20island"');
  });

  test("sem ícone do preview nem logo local, reserva o espaço com o glifo", () => {
    const html = render({ url: PLAY_URL, gameName: "Merge Island" });

    expect(html).toContain("▶");
  });
});
