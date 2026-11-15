const fs = require("node:fs");
const path = require("node:path");

/**
 * `.page-transition` (`pages/_app.js`) envolve **toda** página e existe para a
 * animação de troca de rota.
 *
 * O detalhe que já quebrou uma ferramenta: `animation-fill-mode: both` (ou
 * `forwards`) **retém** o `transform` do último keyframe. Um `transform`
 * retido — mesmo `translateY(0)` — transforma o elemento em **bloco de
 * contenção para `position: fixed`**: todo overlay fixo dentro de uma página
 * passa a ser posicionado em relação a essa div (a coluna de conteúdo, à
 * direita da sidebar e abaixo do header) em vez da viewport.
 *
 * Foi assim que a camada maximizada do visualizador de Markdown nasceu
 * cortada. `backwards` aplica o estado inicial antes da animação começar e
 * devolve os valores normais quando ela termina — visualmente igual, sem o
 * bloco de contenção.
 *
 * Este teste fixa a decisão porque o defeito é invisível em lint, em teste de
 * componente e no clique que maximiza: só aparece na tela, e só quando alguma
 * página usa `position: fixed`.
 */
const CSS = fs.readFileSync(path.join(process.cwd(), "css/styles.css"), "utf8");

/** Corpo da regra, sem os comentários (eles citam `both` de propósito). */
function ruleBody(selector) {
  const start = CSS.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);

  const end = CSS.indexOf("}", start);
  return CSS.slice(start, end).replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

describe("css/styles.css — .page-transition", () => {
  test("mantém a animação de troca de página", () => {
    expect(ruleBody(".page-transition")).toMatch(/animation:\s*page-fade-slide-up/);
  });

  test("não retém o transform depois da animação", () => {
    const body = ruleBody(".page-transition");

    // `both` e `forwards` retêm o último keyframe (transform: translateY(0)),
    // o que cria bloco de contenção para `position: fixed`.
    expect(body).not.toMatch(/\b(both|forwards)\b/);
    expect(body).toMatch(/\bbackwards\b/);
  });
});
