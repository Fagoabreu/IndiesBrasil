import sanitizeHtml from "lib/sanitize.js";

/**
 * O sanitizador é regex-based e caseiro, usado server-side sobre conteúdo de
 * usuário (denúncias, depoimentos) e client-side sobre conteúdo publicado
 * (análises, aulas). Estes testes cobrem:
 *
 *  - a regressão de crash: um input contendo o placeholder literal derrubava
 *    `sanitize()` com TypeError, porque `allowedTags[idx]` vinha `undefined`
 *    e era repassado a `sanitizeTag`.
 *  - as garantias de segurança que já existiam e não podem regredir.
 */
describe("lib/sanitize.js", () => {
  describe(".sanitize() — entrada inválida", () => {
    test("retorna string vazia para valores não-string", () => {
      expect(sanitizeHtml.sanitize()).toBe("");
      expect(sanitizeHtml.sanitize(null)).toBe("");
      expect(sanitizeHtml.sanitize(undefined)).toBe("");
      expect(sanitizeHtml.sanitize(42)).toBe("");
      expect(sanitizeHtml.sanitize({})).toBe("");
    });
  });

  describe(".sanitize() — placeholder (regressão de crash)", () => {
    // Estes inputs derrubavam a função antes do guard de índice: o passo 4
    // tentava restaurar uma tag que nunca foi armazenada.
    test("não lança com placeholder de índice fora do range", () => {
      expect(() => sanitizeHtml.sanitize("<p>oi</p> __TAG_999__")).not.toThrow();
      expect(() => sanitizeHtml.sanitize("__TAG_0__")).not.toThrow();
      expect(() => sanitizeHtml.sanitize("__TAG_1__")).not.toThrow();
    });

    test("placeholder forjado fica inerte (não vira tag)", () => {
      // Com o token aleatório por chamada, `__TAG_0__` deixa de ser um
      // placeholder reconhecível e passa como texto literal do usuário —
      // inofensivo, porque não é HTML. O que não pode acontecer é ele ser
      // restaurado como tag ou derrubar a função.
      const output = sanitizeHtml.sanitize("__TAG_0__");
      expect(output).not.toContain("<");
      expect(output).toBe("__TAG_0__");
    });

    test("placeholder não faz o sanitizador emitir tag arbitrária", () => {
      const output = sanitizeHtml.sanitize("__TAG_0__<script>alert(1)</script>");
      expect(output).not.toContain("script");
      expect(output).not.toContain("alert");
      expect(output).not.toContain("<");
    });
  });

  describe(".sanitize() — remoção de conteúdo perigoso", () => {
    test("remove <script> junto com o conteúdo", () => {
      const output = sanitizeHtml.sanitize("<p>antes</p><script>alert(1)</script><p>depois</p>");
      expect(output).toBe("<p>antes</p><p>depois</p>");
      expect(output).not.toContain("alert");
    });

    test("remove <style>, <iframe>, <object>, <embed> e <noscript>", () => {
      expect(sanitizeHtml.sanitize("<style>body{display:none}</style>")).toBe("");
      expect(sanitizeHtml.sanitize('<iframe src="https://x.com"></iframe>')).toBe("");
      expect(sanitizeHtml.sanitize("<object data=x></object>")).toBe("");
      expect(sanitizeHtml.sanitize("<embed src=x>")).toBe("");
      expect(sanitizeHtml.sanitize("<noscript>x</noscript>")).toBe("");
    });

    test("remove event handlers inline", () => {
      const output = sanitizeHtml.sanitize('<img src="x.png" onerror="alert(1)">');
      expect(output).not.toContain("onerror");
      expect(output).not.toContain("alert");
      expect(output).toContain("x.png");
    });

    test("remove event handler não cotado", () => {
      const output = sanitizeHtml.sanitize("<b onclick=alert(1)>x</b>");
      expect(output).not.toContain("onclick");
    });

    test("neutraliza href com javascript:", () => {
      const output = sanitizeHtml.sanitize('<a href="javascript:alert(1)">x</a>');
      expect(output).not.toContain("javascript:");
      expect(output).toContain('href=""');
    });

    test("neutraliza javascript: ofuscado por entidades HTML", () => {
      const output = sanitizeHtml.sanitize('<a href="&#x6a;avascript:alert(1)">x</a>');
      expect(output).not.toContain("avascript:");
    });

    test("neutraliza data: em href (navegação)", () => {
      const output = sanitizeHtml.sanitize('<a href="data:text/html,<script>alert(1)</script>">x</a>');
      expect(output).not.toContain("data:text/html");
    });

    test("descarta tag não allowlistada", () => {
      const output = sanitizeHtml.sanitize("<p>a</p><marquee>b</marquee><form>c</form>");
      expect(output).not.toContain("marquee");
      expect(output).not.toContain("form");
      expect(output).toContain("<p>a</p>");
      expect(output).toContain("b");
    });
  });

  describe(".sanitize() — preservação de formatação", () => {
    test("mantém tags de formatação allowlistadas", () => {
      expect(sanitizeHtml.sanitize("<b>negrito</b>")).toBe("<b>negrito</b>");
      expect(sanitizeHtml.sanitize("<p>par</p>")).toBe("<p>par</p>");
      expect(sanitizeHtml.sanitize("<ul><li>item</li></ul>")).toBe("<ul><li>item</li></ul>");
      expect(sanitizeHtml.sanitize("<h2>titulo</h2>")).toBe("<h2>titulo</h2>");
      expect(sanitizeHtml.sanitize('<a href="https://exemplo.com">link</a>')).toBe('<a href="https://exemplo.com">link</a>');
    });

    test("preserva texto sem marcação", () => {
      expect(sanitizeHtml.sanitize("apenas texto")).toBe("apenas texto");
    });

    test("é idempotente", () => {
      const input = "<p>a<b>c</b></p><ul><li>d</li></ul>";
      const once = sanitizeHtml.sanitize(input);
      expect(sanitizeHtml.sanitize(once)).toBe(once);
    });
  });

  describe(".sanitize() — robustez", () => {
    test("lida com entrada longa sem travar", () => {
      const input = "<p>abc</p>".repeat(10000);
      expect(() => sanitizeHtml.sanitize(input)).not.toThrow();
      expect(sanitizeHtml.sanitize(input).length).toBeLessThanOrEqual(input.length);
    });

    test("lida com tags não fechadas e aninhamento quebrado", () => {
      expect(() => sanitizeHtml.sanitize("<p><b>a</p></b>")).not.toThrow();
      expect(() => sanitizeHtml.sanitize("<p")).not.toThrow();
      expect(() => sanitizeHtml.sanitize(">")).not.toThrow();
    });

    test("nunca retorna undefined", () => {
      expect(typeof sanitizeHtml.sanitize("<p>a</p>")).toBe("string");
      expect(typeof sanitizeHtml.sanitize("__TAG_0__")).toBe("string");
    });
  });

  describe(".sanitize() — payloads de ataque (regressão)", () => {
    // Cada caso aqui corresponde a uma técnica real de bypass. O sanitizador é
    // regex-based, então o que segura a manutenção é ter os payloads fixados num
    // teste: uma edição futura que abra um destes caminhos falha em vez de
    // passar silenciosamente.
    test("remove event handler com espaços e caixa mista", () => {
      expect(sanitizeHtml.sanitize('<img src=x onerror = "alert(1)">')).not.toMatch(/onerror/i);
      expect(sanitizeHtml.sanitize('<div ONCLICK="alert(1)">a</div>')).not.toMatch(/onclick/i);
      expect(sanitizeHtml.sanitize("<body onload=alert(1)>a</body>")).not.toMatch(/onload/i);
    });

    test("remove event handler ofuscado por entidades", () => {
      expect(sanitizeHtml.sanitize("<img src=x o&#110;error=alert(1)>")).not.toMatch(/onerror/i);
    });

    test("neutraliza javascript: com entidades e separadores", () => {
      expect(sanitizeHtml.sanitize('<a href="java&#115;cript:alert(1)">x</a>')).not.toMatch(/javascript:/i);
      expect(sanitizeHtml.sanitize('<a href="jav&#x09;ascript:alert(1)">x</a>')).not.toMatch(/javascript:/i);
      expect(sanitizeHtml.sanitize('<a href="JAVASCRIPT:alert(1)">x</a>')).not.toMatch(/href="javascript:/i);
    });

    test("neutraliza vbscript: e data: em navegação", () => {
      expect(sanitizeHtml.sanitize('<a href="vbscript:msgbox(1)">x</a>')).not.toMatch(/vbscript:/i);
      expect(sanitizeHtml.sanitize('<a href="data:text/html,<script>alert(1)</script>">x</a>')).not.toMatch(/href="data:/i);
    });

    test("remove o atributo style (sobreposição visual / phishing)", () => {
      const output = sanitizeHtml.sanitize('<div style="position:fixed;inset:0;z-index:99999">falso</div>');
      expect(output).not.toMatch(/style/i);
      expect(output).not.toMatch(/position:fixed/i);
      expect(output).toContain("falso");
    });

    test("remove style com caixa mista e sem aspas", () => {
      expect(sanitizeHtml.sanitize("<p STYLE=color:red>a</p>")).not.toMatch(/style/i);
      expect(sanitizeHtml.sanitize("<p style='color:red'>a</p>")).not.toMatch(/style/i);
    });

    test("remove tags de contexto SVG/MathML junto com o conteúdo executável", () => {
      expect(sanitizeHtml.sanitize("<svg><script>alert(1)</script></svg>")).not.toMatch(/script/i);
      expect(sanitizeHtml.sanitize("<math><mtext><script>alert(1)</script></mtext></math>")).not.toMatch(/script/i);
      expect(sanitizeHtml.sanitize('<iframe srcdoc="<script>alert(1)</script>"></iframe>')).not.toMatch(/script/i);
    });

    test("descarta srcdoc e formaction perigosos", () => {
      expect(sanitizeHtml.sanitize('<form action="javascript:alert(1)"><input></form>')).not.toMatch(/javascript:/i);
    });

    test("é idempotente sobre os payloads (segunda passada não ressuscita nada)", () => {
      const payloads = [
        '<div style="position:fixed">a</div>',
        "<img src=x onerror=alert(1)>",
        '<a href="javascript:alert(1)">x</a>',
        "<svg><script>alert(1)</script></svg>",
      ];

      for (const payload of payloads) {
        const once = sanitizeHtml.sanitize(payload);
        const twice = sanitizeHtml.sanitize(once);
        expect(twice).toBe(once);
        expect(twice).not.toMatch(/onerror|javascript:|<script|style=/i);
      }
    });
  });
});
