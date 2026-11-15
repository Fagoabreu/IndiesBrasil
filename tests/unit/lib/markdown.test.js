import { IMAGE_PROXY_PATH, MAX_MARKDOWN_LENGTH, renderMarkdown } from "lib/markdown.js";

/**
 * `lib/markdown.js` é o único caminho entre "Markdown que a pessoa colou" e
 * "HTML na página". Estes testes cobrem três frentes:
 *
 *  1. **estrutura** — o GFM que o `marked` promete (tabelas, tarefas, riscado);
 *  2. **segurança** — os payloads que o sanitizador precisa matar, fixados como
 *     regressão (mesmo padrão de `tests/unit/lib/sanitize.test.js`);
 *  3. **pós-processamento** — proxy de imagem, `rel` de link externo e o
 *     contêiner de tabela, que são a parte que o sanitizador não faz sozinho.
 */
describe("lib/markdown.js", () => {
  describe(".renderMarkdown() — estados de entrada", () => {
    test("devolve erro 'empty' para entrada vazia ou inválida", () => {
      expect(renderMarkdown("")).toEqual({ html: "", error: "empty" });
      expect(renderMarkdown("   \n  ")).toEqual({ html: "", error: "empty" });
      expect(renderMarkdown(null)).toEqual({ html: "", error: "empty" });
      expect(renderMarkdown(undefined)).toEqual({ html: "", error: "empty" });
      expect(renderMarkdown(42)).toEqual({ html: "", error: "empty" });
    });

    test("recusa documento acima do teto antes de qualquer regex", () => {
      const huge = "a".repeat(MAX_MARKDOWN_LENGTH + 1);
      expect(renderMarkdown(huge)).toEqual({ html: "", error: "too-large" });
    });

    test("aceita documento exatamente no teto", () => {
      const result = renderMarkdown("a".repeat(MAX_MARKDOWN_LENGTH));
      expect(result.error).toBeNull();
      expect(result.html).toContain("<p>");
    });

    test("nunca lança com entrada malformada", () => {
      expect(() => renderMarkdown("[".repeat(5000))).not.toThrow();
      expect(() => renderMarkdown("<".repeat(5000))).not.toThrow();
      expect(() => renderMarkdown("```\nnunca fecha")).not.toThrow();
      expect(() => renderMarkdown("| a |\n|---|\n| 1 |")).not.toThrow();
    });
  });

  describe(".renderMarkdown() — estrutura", () => {
    test("converte títulos, parágrafos, listas e citação", () => {
      const { html, error } = renderMarkdown("# Título\n\nTexto.\n\n- um\n- dois\n\n> citação");

      expect(error).toBeNull();
      expect(html).toContain("<h1>Título</h1>");
      expect(html).toContain("<p>Texto.</p>");
      expect(html).toContain("<li>um</li>");
      expect(html).toContain("<blockquote>");
    });

    test("converte tabela GFM", () => {
      const { html } = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");

      expect(html).toContain("<table>");
      expect(html).toContain("<th>a</th>");
      expect(html).toContain("<td>1</td>");
    });

    test("converte riscado e bloco de código", () => {
      const { html } = renderMarkdown("~~fora~~\n\n```js\nconst a = 1;\n```");

      expect(html).toContain("<del>fora</del>");
      expect(html).toContain("<pre><code");
      expect(html).toContain("const a = 1;");
    });

    test("lista de tarefas vira marcador de texto, sem <input>", () => {
      const { html } = renderMarkdown("- [x] feito\n- [ ] pendente");

      expect(html).toContain("☑");
      expect(html).toContain("☐");
      // `<input>` não está na allowlist do sanitizador: um formulário dentro de
      // conteúdo de usuário é vetor de phishing.
      expect(html).not.toContain("<input");
    });
  });

  describe(".renderMarkdown() — segurança", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      '<iframe src="https://exemplo.com"></iframe>',
      "<style>body{display:none}</style>",
      '<object data="x"></object>',
      '<embed src="x">',
      "[clique](javascript:alert(1))",
      '<a href="&#106;avascript:alert(1)">clique</a>',
      '<div onmouseover="alert(1)">passe o mouse</div>',
      '<p style="position:fixed;inset:0">sobreposição</p>',
    ];

    test.each(payloads)("neutraliza %s", (payload) => {
      const { html } = renderMarkdown(payload);

      expect(html.toLowerCase()).not.toContain("<script");
      expect(html.toLowerCase()).not.toContain("<iframe");
      expect(html.toLowerCase()).not.toContain("<object");
      expect(html.toLowerCase()).not.toContain("<embed");
      expect(html.toLowerCase()).not.toContain("<style");
      expect(html.toLowerCase()).not.toContain("javascript:");
      expect(html.toLowerCase()).not.toContain("onerror=");
      expect(html.toLowerCase()).not.toContain("onmouseover=");
      expect(html.toLowerCase()).not.toContain("style=");
    });

    test("não deixa escapar fechamento de script no meio do texto", () => {
      const { html } = renderMarkdown("texto </script><img src=x onerror=alert(1)> fim");
      expect(html).not.toContain("onerror");
    });
  });

  describe(".renderMarkdown() — imagens", () => {
    test("imagem remota passa pelo proxy", () => {
      const { html } = renderMarkdown("![capa](https://exemplo.com/a.png)");

      expect(html).toContain(`${IMAGE_PROXY_PATH}?url=${encodeURIComponent("https://exemplo.com/a.png")}`);
      expect(html).toContain('alt="capa"');
    });

    test("query string da imagem original vai codificada, sem virar parâmetro do proxy", () => {
      const source = "https://exemplo.com/a.png?w=200&h=100";
      const { html } = renderMarkdown(`![x](${source})`);

      expect(html).toContain(`url=${encodeURIComponent(source)}`);
      // Um `&` solto transformaria `h=100` em parâmetro do proxy.
      expect(html).not.toContain("&h=100");
    });

    test("imagem data: e caminho relativo ficam intactos", () => {
      const data = "data:image/png;base64,iVBORw0KGgo=";
      expect(renderMarkdown(`![a](${data})`).html).toContain(data);

      const relative = renderMarkdown("![b](/images/logo.png)").html;
      expect(relative).toContain('src="/images/logo.png"');
      expect(relative).not.toContain(IMAGE_PROXY_PATH);
    });

    test("imagem fica com carregamento preguiçoso e sem referrer", () => {
      const { html } = renderMarkdown("![capa](https://exemplo.com/a.png)");

      expect(html).toContain('loading="lazy"');
      expect(html).toContain('referrerpolicy="no-referrer"');
    });
  });

  describe(".renderMarkdown() — links", () => {
    test("link externo abre em outra aba, sem window.opener", () => {
      const { html } = renderMarkdown("[site](https://exemplo.com)");

      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    test("âncora interna não abre outra aba", () => {
      const { html } = renderMarkdown("[voltar ao topo](#topo)");

      expect(html).toContain('href="#topo"');
      expect(html).not.toContain('target="_blank"');
    });

    test("mailto continua na mesma aba", () => {
      const { html } = renderMarkdown("[fale](mailto:oi@exemplo.com)");

      expect(html).toContain("mailto:oi@exemplo.com");
      expect(html).not.toContain('target="_blank"');
    });
  });

  describe(".renderMarkdown() — contêiner de tabela", () => {
    test("envolve a tabela quando a classe é informada", () => {
      const { html } = renderMarkdown("| a |\n|---|\n| 1 |", { tableWrapperClass: "tabelaRolavel" });

      expect(html).toContain('<div class="tabelaRolavel"><table>');
    });

    test("não envolve nada quando a classe não é informada", () => {
      const { html } = renderMarkdown("| a |\n|---|\n| 1 |");

      expect(html).toContain("<table>");
      expect(html).not.toContain("<div");
    });
  });
});
