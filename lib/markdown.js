/**
 * Renderização de Markdown para o visualizador de `/ferramentas/mdviewer`.
 *
 * ## Por que este módulo existe
 *
 * O caminho entre "texto que a pessoa colou" e "HTML na página" precisa
 * acontecer em **um** lugar. Se a página chamasse `marked` direto e depois
 * injetasse o resultado, a segurança ficaria na tela: qualquer outra superfície
 * que quisesse renderizar Markdown repetiria (ou esqueceria) a sanitização.
 *
 * A regra é `marked` → `sanitize` → pós-processamento, sempre nessa ordem:
 *
 *   1. `marked` gera HTML (GFM: tabelas, listas de tarefas, riscado);
 *   2. `lib/sanitize.js` remove `<script>`, `<style>`, `<iframe>`, `<object>`,
 *      `<embed>`, handlers `on*`, atributos `style` e URLs `javascript:`;
 *   3. o pós-processamento só acrescenta atributos a tags que **já passaram**
 *      pelo filtro — nunca reintroduz nada que o sanitizador tenha removido.
 *
 * A etapa 3 é obrigatória e não é cosmética:
 *  - **Imagem remota** vira `/api/v1/image-proxy?url=…`. A CSP de produção
 *    (`deploy/nginx/indies.https.conf`) libera `img-src` só para os hosts
 *    conhecidos, então um README com `![](https://raw.githubusercontent…)`
 *    renderiza em `npm run dev` (que não aplica CSP) e quebra no deploy — sem
 *    erro visível, só um ícone de imagem quebrada.
 *  - **Link externo** ganha `target="_blank" rel="noopener noreferrer"`: a
 *    pessoa está lendo um documento, e o clique não deve tirá-la da página.
 *  - **Tabela** ganha um contêiner com `overflow-x`: sem ele uma tabela larga
 *    estica a coluna do grid (`1fr 1fr`) em vez de rolar.
 *
 * Nada aqui depende do browser, de CSS Module ou de estado de componente — é o
 * que permite testar as garantias de segurança em `tests/unit/lib/markdown.test.js`.
 */

import { Marked } from "marked";

import sanitizeHtml from "./sanitize.js";

/**
 * Teto de entrada, em caracteres.
 *
 * Mesmo valor de `viewer.jsx`/`htmlviewer.jsx`: a checagem acontece **antes** de
 * qualquer regex, para que uma entrada gigante não vire custo de CPU/memória
 * (o `sanitize` roda várias passadas de regex sobre a string inteira).
 */
export const MAX_MARKDOWN_LENGTH = 300_000;

/** Caminho do proxy de imagem (`pages/api/v1/image-proxy.js`). */
export const IMAGE_PROXY_PATH = "/api/v1/image-proxy";

/** Só URLs absolutas de rede passam pelo proxy; `data:`/`blob:`/relativas não. */
const REMOTE_URL = /^https?:\/\//i;

/** Marcadores de lista de tarefas (o sanitizador não permite `<input>`). */
const TASK_DONE_MARKER = '<span aria-hidden="true">☑</span> ';
const TASK_TODO_MARKER = '<span aria-hidden="true">☐</span> ';

/**
 * Instância própria de `marked`.
 *
 * A instância estática (`marked.parse`) guarda opções em estado global: uma
 * página que ligasse `breaks` mudaria o comportamento de todas as outras que
 * compartilhassem o processo. Uma instância por chamada seria correta e cara —
 * então a instância é de módulo, com opções fixas e `async: false`, que é o que
 * faz `parse` devolver string em vez de Promise.
 */
const marked = new Marked({
  gfm: true,
  breaks: false,
  async: false,
});

/** Lê o valor de um atributo num trecho de tag, ou `null`. */
function getAttribute(tag, name) {
  const match = new RegExp(String.raw`\s${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))`, "i").exec(tag);
  if (!match) return null;
  if (match[2] !== undefined) return match[2];
  if (match[3] !== undefined) return match[3];
  return match[4];
}

/** Escapa o valor para uso dentro de aspas duplas de um atributo. */
function escapeAttributeValue(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Garante `name="value"` na tag.
 *
 * Substitui o valor quando o atributo já existe e o insere antes do `>` (ou do
 * `/>`) quando não existe. Inserir em vez de reconstruir a tag preserva todos
 * os outros atributos que o sanitizador aprovou.
 */
function setAttribute(tag, name, value) {
  const escaped = escapeAttributeValue(value);
  const existing = new RegExp(String.raw`\s${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))`, "i");

  if (existing.test(tag)) {
    return tag.replace(existing, ` ${name}="${escaped}"`);
  }

  return tag.replace(/\s*(\/?)>$/, (_match, selfClosing) => ` ${name}="${escaped}"${selfClosing ? " /" : ""}>`);
}

/** Aplica `transform` a toda tag `tagName` do HTML. */
function mapTags(html, tagName, transform) {
  return html.replace(new RegExp(String.raw`<${tagName}\b[^>]*>`, "gi"), (tag) => transform(tag));
}

/**
 * Troca o `<input type="checkbox">` das listas de tarefas do GFM por um
 * marcador de texto.
 *
 * O sanitizador não permite `<input>` (formulário dentro de conteúdo de usuário
 * é vetor de phishing), e sem esta troca a caixa simplesmente desaparecia da
 * lista. O caractere sobrevive porque vai dentro de um `<span>` permitido.
 *
 * Roda **antes** do sanitizador de propósito: é mais simples trocar a tag por
 * uma permitida do que abrir exceção na allowlist para o sanitizador inteiro.
 */
function renderTaskListMarkers(html) {
  return html.replace(/<input\b[^>]*>/gi, (tag) => (/checked/i.test(tag) ? TASK_DONE_MARKER : TASK_TODO_MARKER));
}

/** Reescreve imagens remotas para o proxy e as torna preguiçosas. */
function rewriteImages(html) {
  return mapTags(html, "img", (tag) => {
    let next = tag;

    const source = getAttribute(next, "src");
    if (source && REMOTE_URL.test(source)) {
      // `encodeURIComponent` protege a URL inteira: a query do proxy recebe o
      // endereço como **dado**, então um `&` no original não vira parâmetro
      // novo. Sem isso, `?url=a&x=b` chegaria ao proxy como dois parâmetros.
      next = setAttribute(next, "src", `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(source)}`);
    }

    // `loading=lazy` evita baixar 40 imagens de um README que ninguém rolou.
    // `referrerpolicy` impede que o pedido ao proxy leve a URL da nossa página.
    next = setAttribute(next, "loading", "lazy");
    next = setAttribute(next, "referrerpolicy", "no-referrer");
    return next;
  });
}

/** Abre links externos em outra aba, sem `window.opener`. */
function annotateLinks(html) {
  return mapTags(html, "a", (tag) => {
    const href = getAttribute(tag, "href");
    // Âncora interna (`#secao`) e `mailto:` ficam na mesma aba: abrir uma nova
    // para um salto dentro do próprio documento é ruído.
    if (!href || !REMOTE_URL.test(href)) return tag;

    let next = setAttribute(tag, "target", "_blank");
    next = setAttribute(next, "rel", "noopener noreferrer");
    return next;
  });
}

/**
 * Envolve cada tabela num contêiner rolável.
 *
 * A classe vem por parâmetro porque o CSS Module é hasheado por arquivo: uma
 * string fixa aqui produziria um nome que não existe em nenhum módulo, e o
 * estilo nunca aplicaria (`className` sem CSS correspondente).
 */
function wrapTables(html, wrapperClass) {
  if (!wrapperClass) return html;
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => `<div class="${wrapperClass}">${table}</div>`);
}

/**
 * Converte Markdown em HTML seguro para `dangerouslySetInnerHTML`.
 *
 * Nunca lança: Markdown malformado é entrada normal (texto de usuário), não
 * erro de programação. Entrada vazia e entrada acima do teto são estados da
 * tela, não exceções.
 *
 * @param {string} source — o Markdown cru.
 * @param {{ tableWrapperClass?: string }} [options]
 *   `tableWrapperClass`: classe (do CSS Module da página) aplicada ao
 *   contêiner de cada tabela.
 * @returns {{ html: string, error: "empty"|"too-large"|null }}
 *   `html` é sempre string (vazia quando há erro).
 */
export function renderMarkdown(source, options = {}) {
  const { tableWrapperClass } = options;

  if (typeof source !== "string" || !source.trim()) {
    return { html: "", error: "empty" };
  }

  if (source.length > MAX_MARKDOWN_LENGTH) {
    return { html: "", error: "too-large" };
  }

  let html;
  try {
    html = marked.parse(source, { async: false });
  } catch {
    // `marked` só lança em configuração inválida — mas uma ferramenta pública
    // não pode devolver 500 por causa de um documento estranho.
    return { html: "", error: null };
  }

  // `parse` devolve Promise se `async` for ligado; o `String()` documenta a
  // intenção e cobre o caso de uma opção global ter sido alterada em outro
  // lugar do código.
  const parsed = String(html);

  const withMarkers = renderTaskListMarkers(parsed);
  const safe = sanitizeHtml.sanitize(withMarkers);
  const withImages = rewriteImages(safe);
  const withLinks = annotateLinks(withImages);

  return { html: wrapTables(withLinks, tableWrapperClass), error: null };
}

const markdown = {
  MAX_MARKDOWN_LENGTH,
  IMAGE_PROXY_PATH,
  renderMarkdown,
};

export default markdown;
