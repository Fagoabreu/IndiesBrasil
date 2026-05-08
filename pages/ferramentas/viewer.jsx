import SeoHead from "@/components/SeoHead";
import { useState, useCallback } from "react";
import { Button } from "@primer/react";
import { CopyIcon, CheckIcon, TrashIcon, CodeIcon } from "@primer/octicons-react";

import shared from "./toolPage.module.css";
import styles from "./viewer.module.css";
import { SITE_URL } from "@/lib/seo";

// Maximum input size (bytes) accepted before any regex runs.
// Prevents ReDoS via excessively large payloads.
const MAX_INPUT_LENGTH = 200_000;

const PAGE_TITLE = "Visualizador e Formatador de JSON e XML Online | Indies Brasil";
const PAGE_DESCRIPTION =
  "Formate, visualize e valide JSON e XML com syntax highlighting e indentação automática. Ferramenta online grátis, sem cadastro e sem instalação.";
const PAGE_URL = `${SITE_URL}/ferramentas/viewer`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Visualizador XML / JSON — Indies Brasil",
  url: PAGE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  featureList: "json formatter, xml formatter, syntax highlighting, json validator, xml validator",
};

function detectType(raw) {
  const t = raw.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.startsWith("<")) return "xml";
  return null;
}

function formatJSON(raw) {
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed, null, 2);
}

// Returns true when token[i] is an opening tag followed by
// plain text and immediately closed: <tag>value</tag>.
function isInlineElement(tokens, i) {
  const next = tokens[i + 1];
  const afterNext = tokens[i + 2];
  return next !== undefined && !next.startsWith("<") && afterNext !== undefined && afterNext.startsWith("</");
}

function formatXML(raw) {
  let formatted = "";
  let indent = 0;
  const TAB = "  ";

  // Collapse whitespace between tags then tokenize.
  // \s{1,500} and [^>]{0,2000} use bounded quantifiers to prevent ReDoS.
  const normalized = raw.replaceAll(/>\s{1,500}</g, "><").trim();
  const tokens = normalized.split(/(<[^>]{0,2000}>)/g).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.trim()) continue;

    const isClosing = token.startsWith("</");
    const isSelfClosing = token.endsWith("/>") || token.startsWith("<?") || token.startsWith("<!");
    const isOpening = token.startsWith("<") && !isClosing && !isSelfClosing;

    if (isClosing) indent = Math.max(0, indent - 1);

    // Inline pattern: <tag>text content</tag> → emit on a single line.
    if (isOpening && isInlineElement(tokens, i)) {
      formatted += TAB.repeat(indent) + token + tokens[i + 1].trim() + tokens[i + 2] + "\n";
      i += 2;
      continue;
    }

    formatted += TAB.repeat(indent) + token + "\n";

    if (isOpening) indent++;
  }

  return formatted.trimEnd();
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function highlightJSON(code, hlKey, hlString, hlNumber, hlBool, hlNull) {
  const esc = escapeHtml(code);
  const result = [];
  const lines = esc.split("\n");

  for (const line of lines) {
    const keyMatch = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:)(.*)$/.exec(line);
    if (keyMatch) {
      result.push(
        `${keyMatch[1]}<span class="${hlKey}">${keyMatch[2]}</span>${keyMatch[3]}${colorValue(keyMatch[4], hlString, hlNumber, hlBool, hlNull)}`,
      );
      continue;
    }
    result.push(colorValue(line, hlString, hlNumber, hlBool, hlNull));
  }

  return result.join("\n");
}

function colorValue(seg, hlString, hlNumber, hlBool, hlNull) {
  return seg
    .replaceAll(/("(?:[^"\\]|\\.)*")/g, `<span class="${hlString}">$1</span>`)
    .replaceAll(/\b(true|false)\b/g, `<span class="${hlBool}">$1</span>`)
    .replaceAll(/\bnull\b/g, `<span class="${hlNull}">null</span>`)
    .replaceAll(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, `<span class="${hlNumber}">$1</span>`);
}

function highlight(code, type, s) {
  if (!code) return "";

  if (type === "json") {
    return highlightJSON(code, s.hlKey, s.hlString, s.hlNumber, s.hlBool, s.hlNull);
  }

  if (type === "xml") {
    const esc = escapeHtml(code);
    // Bounded quantifiers {1,N} prevent super-linear backtracking (ReDoS).
    return esc
      .replaceAll(/(&lt;\/?[\w:.-]{1,200})/g, `<span class="${s.hlTag}">$1</span>`)
      .replaceAll(/([\w:.-]{1,200})(=&quot;)/g, `<span class="${s.hlAttr}">$1</span>$2`)
      .replaceAll(/(&quot;[^&]{0,2000}&quot;)/g, `<span class="${s.hlString}">$1</span>`)
      .replaceAll(/(&lt;\?[^&]{0,2000}\?&gt;)/g, `<span class="${s.hlDecl}">$1</span>`)
      .replaceAll(/(&lt;!--[\s\S]{0,5000}?--&gt;)/g, `<span class="${s.hlComment}">$1</span>`);
  }

  return escapeHtml(code);
}

export default function ViewerPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [type, setType] = useState(null); // "json" | "xml" | null
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const format = useCallback(() => {
    setError(null);
    setOutput("");
    setType(null);

    const raw = input.trim();
    if (!raw) return;

    // Guard against excessively large inputs before any regex runs (ReDoS prevention).
    if (raw.length > MAX_INPUT_LENGTH) {
      setError(`Entrada muito grande. O limite é ${(MAX_INPUT_LENGTH / 1000).toFixed(0)} KB.`);
      return;
    }

    const detected = detectType(raw);

    if (!detected) {
      setError("Não foi possível identificar o formato. Cole um texto JSON ou XML válido.");
      return;
    }

    try {
      const result = detected === "json" ? formatJSON(raw) : formatXML(raw);
      setOutput(result);
      setType(detected);
    } catch (e) {
      setError(`Erro ao formatar ${detected.toUpperCase()}: ${e.message}`);
    }
  }, [input]);

  const copy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [output]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setType(null);
    setError(null);
  }, []);

  const highlighted = output ? highlight(output, type, styles) : "";

  function renderOutput() {
    if (error) {
      return <div className={shared.errorBox}>{error}</div>;
    }
    if (output) {
      return (
        <pre
          className={styles.output}
          // highlight() escapes user content via escapeHtml before injecting spans
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      );
    }
    return <div className={shared.emptyOutput}>O resultado formatado aparecerá aqui.</div>;
  }

  return (
    <div className={shared.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      {/* Page header */}
      <header className={shared.pageHeader}>
        <h1 className={shared.pageTitle}>Visualizador XML / JSON</h1>
        <p className={shared.pageSubtitle}>Cole um texto sem formatação e visualize com identação e syntax highlighting.</p>
      </header>

      <div className={shared.workspace}>
        {/* Input panel */}
        <section className={shared.panel}>
          <div className={shared.panelHeader}>
            <span className={shared.panelLabel}>Entrada</span>
            <Button size="small" variant="invisible" onClick={clear} aria-label="Limpar">
              <TrashIcon size={14} />
              Limpar
            </Button>
          </div>

          <textarea
            className={shared.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Cole seu JSON ou XML aqui...\n\n{"exemplo":true}\n<root><item id="1">texto</item></root>'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />

          <div className={shared.panelFooter}>
            <span className={shared.charCount}>{input.length > 0 ? `${input.length} caracteres` : ""}</span>
            <Button onClick={format} disabled={!input.trim()}>
              <CodeIcon size={14} />
              Formatar
            </Button>
          </div>
        </section>

        {/* Output panel */}
        <section className={shared.panel}>
          <div className={shared.panelHeader}>
            <span className={shared.panelLabel}>
              Resultado
              {type && <span className={styles.typeBadge}>{type.toUpperCase()}</span>}
            </span>
            <Button size="small" variant="invisible" onClick={copy} disabled={!output} aria-label="Copiar">
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>

          {renderOutput()}
        </section>
      </div>
    </div>
  );
}
