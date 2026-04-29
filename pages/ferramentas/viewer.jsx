import { useState, useCallback } from "react";
import { Button } from "@primer/react";
import { CopyIcon, CheckIcon, TrashIcon, CodeIcon } from "@primer/octicons-react";

import styles from "./viewer.module.css";

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

function formatXML(raw) {
  let formatted = "";
  let indent = 0;
  const TAB = "  ";

  // Collapse whitespace between tags then tokenize
  const normalized = raw.replaceAll(/>\s+</g, "><").trim();
  const tokens = normalized.split(/(<[^>]+>)/g).filter(Boolean);

  for (const token of tokens) {
    if (!token.trim()) continue;

    const isClosing = token.startsWith("</");
    const isSelfClosing = token.endsWith("/>") || token.startsWith("<?") || token.startsWith("<!");
    const isOpening = token.startsWith("<") && !isClosing && !isSelfClosing;

    if (isClosing) indent = Math.max(0, indent - 1);

    formatted += TAB.repeat(indent) + token + "\n";

    if (isOpening) indent++;
  }

  return formatted.trimEnd();
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function highlightJSON(code, hlKey, hlString, hlNumber, hlBool, hlNull) {
  const esc = escapeHtml(code);
  // Split into segments to avoid complex single-pass regex
  const result = [];
  let i = 0;
  const lines = esc.split("\n");

  for (const line of lines) {
    // Match JSON line patterns individually for simplicity
    const keyMatch = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:)(.*)$/.exec(line);
    if (keyMatch) {
      result.push(
        `${keyMatch[1]}<span class="${hlKey}">${keyMatch[2]}</span>${keyMatch[3]}${colorValue(keyMatch[4], hlString, hlNumber, hlBool, hlNull)}`
      );
      continue;
    }
    result.push(colorValue(line, hlString, hlNumber, hlBool, hlNull));
    i++;
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
    return esc
      .replaceAll(/(&lt;\/?)([\w:.-]+)/g, `$1<span class="${s.hlTag}">$2</span>`)
      .replaceAll(/([\w:.-]+)(=&quot;)/g, `<span class="${s.hlAttr}">$1</span>$2`)
      .replaceAll(/(&quot;[^&]*&quot;)/g, `<span class="${s.hlString}">$1</span>`)
      .replaceAll(/(&lt;\?[^&]*\?&gt;)/g, `<span class="${s.hlDecl}">$1</span>`)
      .replaceAll(/(&lt;!--[\s\S]*?--&gt;)/g, `<span class="${s.hlComment}">$1</span>`);
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
      return <div className={styles.errorBox}>{error}</div>;
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
    return <div className={styles.emptyOutput}>O resultado formatado aparecerá aqui.</div>;
  }

  return (
    <div className={styles.container}>
      {/* Page header */}
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Visualizador XML / JSON</h1>
        <p className={styles.pageSubtitle}>
          Cole um texto sem formatação e visualize com identação e syntax highlighting.
        </p>
      </header>

      <div className={styles.workspace}>
        {/* Input panel */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Entrada</span>
            <Button size="small" variant="invisible" onClick={clear} aria-label="Limpar">
              <TrashIcon size={14} />
              Limpar
            </Button>
          </div>

          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Cole seu JSON ou XML aqui...\n\n{"exemplo":true}\n<root><item id="1">texto</item></root>'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />

          <div className={styles.panelFooter}>
            <span className={styles.charCount}>{input.length > 0 ? `${input.length} caracteres` : ""}</span>
            <Button onClick={format} disabled={!input.trim()}>
              <CodeIcon size={14} />
              Formatar
            </Button>
          </div>
        </section>

        {/* Output panel */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>
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
