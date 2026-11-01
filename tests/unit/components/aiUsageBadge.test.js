import { renderToStaticMarkup } from "react-dom/server";
import AiUsageBadge from "@/components/AiUsageBadge";

/**
 * Selo de uso de IA nos cards e nas páginas de produto.
 *
 * O que o teste fixa: o **produto não declarado** continua dizendo alguma
 * coisa (`IA N/C`). Esconder o selo quando `ai_level` é nulo faria "ninguém
 * respondeu" parecer "sem uso de IA" — que é justamente o estado que a coluna
 * separa com um `CHECK` no banco.
 */
function render(props) {
  return renderToStaticMarkup(<AiUsageBadge {...props} />);
}

describe("components/AiUsageBadge", () => {
  test("nível declarado mostra o número", () => {
    const html = render({ level: 3 });

    expect(html).toContain("IA 3");
    expect(html).toContain("IA Co-Criativa");
  });

  test("nível 0 aparece como declarado, não como ausência", () => {
    const html = render({ level: 0 });

    expect(html).toContain("IA 0");
    expect(html).toContain("Sem Uso de IA");
  });

  test("não declarado aparece como N/C", () => {
    const html = render({ level: null });

    expect(html).toContain("IA N/C");
    expect(html).toContain("não informado");
  });

  test("aceita nível vindo como string da API", () => {
    const html = render({ level: "5" });

    expect(html).toContain("IA 5");
    expect(html).toContain("IA Autônoma");
  });
});
