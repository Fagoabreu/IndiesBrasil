import { renderToStaticMarkup } from "react-dom/server";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";

/**
 * O componente aceita duas APIs e precisa continuar aceitando as duas.
 *
 * O que motivou o teste: as telas de estúdio, assets e cursos passam
 * `type` + `message`, mas o componente só lia `errorMsg`/`successMsg` — ele
 * renderizava `<div></div>` e o 400/403 de "Salvar serviços" **desaparecia**.
 * A aba de serviços ficava vazia sem nenhuma pista de permissão ou validação.
 */
describe("components/StatusMessage", () => {
  test("API nova: erro aparece e usa o tom de perigo", () => {
    const html = renderToStaticMarkup(<StatusMessageComponent type="error" message="Não foi possível salvar." />);

    expect(html).toContain("Não foi possível salvar.");
    expect(html).toContain("danger");
  });

  test("API nova: sucesso aparece", () => {
    const html = renderToStaticMarkup(<StatusMessageComponent type="success" message="Serviços atualizados." />);

    expect(html).toContain("Serviços atualizados.");
    expect(html).toContain("success");
  });

  test("tipo `danger` (usado no carregamento do editor) também renderiza", () => {
    const html = renderToStaticMarkup(<StatusMessageComponent type="danger" message="Catálogo indisponível." />);

    expect(html).toContain("Catálogo indisponível.");
  });

  test("API original continua funcionando", () => {
    const html = renderToStaticMarkup(<StatusMessageComponent errorMsg={{ message: "Credenciais inválidas.", action: "Tente novamente." }} />);

    expect(html).toContain("Credenciais inválidas.");
    expect(html).toContain("Tente novamente.");
  });

  test("sem mensagem não renderiza caixa vazia", () => {
    expect(renderToStaticMarkup(<StatusMessageComponent />)).toBe("");
  });
});
