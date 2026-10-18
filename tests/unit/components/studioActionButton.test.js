import { renderToStaticMarkup } from "react-dom/server";
import StudioActionButton from "@/components/Studio/StudioActionButton";

/**
 * Estado desabilitado dos botões de ação do estúdio.
 *
 * O que motivou o teste: "Loja" e "Pedidos" precisam ficar desativados enquanto
 * a loja não está pronta (`STORE_SALES_ENABLED`). O erro fácil aqui é usar um
 * `<Link>` com `aria-disabled` — link não tem estado desabilitado, e com `href`
 * ele continua navegável por clique, teclado e "abrir em nova aba". O teste fixa
 * o que importa: no estado desabilitado **não existe `href`** e o elemento é um
 * `<button disabled>`.
 */

function render(props) {
  return renderToStaticMarkup(<StudioActionButton label="Loja" {...props} />);
}

describe("components/Studio/StudioActionButton", () => {
  test("habilitado é um link de verdade", () => {
    const html = render({ href: "/estudios/estudio/loja" });

    expect(html).toContain("<a ");
    expect(html).toContain('href="/estudios/estudio/loja"');
    expect(html).not.toContain("disabled");
  });

  test("desabilitado é um botão, não um link — sem href para clicar", () => {
    const html = render({ href: "/estudios/estudio/loja", disabled: true, disabledHint: "Loja em construção." });

    expect(html).toContain("<button");
    expect(html).toContain("disabled");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });

  test("o rótulo continua visível quando desabilitado", () => {
    // Esconder o botão faria a loja parecer inexistente: a intenção é anunciar
    // que ela vem, não sumir com ela.
    const html = render({ disabled: true });

    expect(html).toContain("Loja");
  });

  test("a dica explica o motivo pelo `title`", () => {
    const html = render({ disabled: true, disabledHint: "Loja em construção — disponível em breve." });

    expect(html).toContain('title="Loja em construção — disponível em breve."');
  });

  test("`external` abre em nova aba só quando habilitado", () => {
    const aberto = render({ href: "/estudios/estudio/press-kit", label: "Press Kit", external: true });
    expect(aberto).toContain('target="_blank"');
    expect(aberto).toContain('rel="noopener noreferrer"');

    const normal = render({ href: "/estudios/estudio/reunioes" });
    expect(normal).not.toContain("target=");
  });
});
