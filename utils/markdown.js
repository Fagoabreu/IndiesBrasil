/* =========================================================
 * Markdown → HTML  —  parser artesanal, zero dependências
 *
 * Suporta:
 *   **negrito**  *itálico*  ~~tachado~~  ||spoiler||
 *   `código inline`   ```bloco de código```
 *   [texto](url)   quebras de linha → <br>
 *
 * Segurança: escapa < > & " antes de parsear, evitando XSS.
 * Links abrem em nova aba com rel="noopener noreferrer".
 * ========================================================= */

/**
 * Converte texto markdown simples para HTML seguro.
 */
export function markdownToHtml(text) {
  if (!text) return "";

  // 1. Escapa HTML cru (previne XSS)
  let html = escapeHtml(text);

  // 2. Blocos de código (``` ... ```) — processar antes de inline
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code.replace(/&lt;/g, "&amp;lt;").replace(/&gt;/g, "&amp;gt;");
    return `<pre><code>${escaped.trim()}</code></pre>`;
  });

  // 2.5  Spoiler (||texto||) — a interação de clique é feita via event delegation no React
  html = html.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');

  // 3. Código inline (`...`)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Negrito (**...**)
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

  // 5. Itálico (*...*)
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  // 6. Tachado (~~...~~)
  html = html.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  // 7. Links [texto](url) — valida o scheme para bloquear XSS (javascript:, data:, vbscript:)
  html = html.replace(/\[([^\]]+)\]\((\S+?)\)/g, (_match, text, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return text;
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // 8. Parágrafos (separados por \n\n+)
  html = html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");

  // Se não gerou <p>, envolve tudo
  if (!html.startsWith("<p>")) {
    html = `<p>${html.replace(/\n/g, "<br />")}</p>`;
  }

  return html;
}

/**
 * Escapa caracteres HTML especiais.
 */
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Valida o scheme de uma URL de link markdown.
 * Permite http(s), protocol-relative (//) e caminhos relativos/âncoras.
 * Bloqueia javascript:, data:, vbscript: e qualquer outro scheme.
 * @param {string} url
 * @returns {string|null} URL segura ou null se insegura.
 */
function sanitizeUrl(url) {
  const trimmed = url.trim();

  // http(s):// ou protocol-relative //
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;

  // Qualquer outro scheme (javascript:, data:, vbscript:, file:, ...)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  // Caminho relativo (/foo), âncora (#foo), etc.
  return trimmed;
}

export function escapeHtmlString(str) {
  return escapeHtml(str);
}

const markdown = { markdownToHtml, escapeHtml: escapeHtmlString };
export default markdown;
