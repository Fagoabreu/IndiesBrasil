import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@primer/react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  MarkdownIcon,
  PencilIcon,
  ScreenFullIcon,
  ScreenNormalIcon,
  TrashIcon,
  UploadIcon,
} from "@primer/octicons-react";

import PageHeader from "@/components/PageHeader";
import SeoHead from "@/components/SeoHead";

import shared from "./toolPage.module.css";
import mdBody from "@/components/Markdown/markdownBody.module.css";
import styles from "./mdviewer.module.css";

import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { downloadBlob } from "@/lib/download";
import { MAX_MARKDOWN_LENGTH, renderMarkdown } from "@/lib/markdown";

const PAGE_TITLE = `Visualizador de Markdown Online — Prévia de arquivo .md | ${SITE_NAME}`;
const PAGE_DESCRIPTION =
  "Cole ou abra um arquivo Markdown e veja o documento renderizado em tempo real, com títulos, tabelas, listas de tarefas e blocos de código. Ferramenta online gratuita, sem cadastro e sem upload.";
const PAGE_URL = `${SITE_URL}/ferramentas/mdviewer`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `Visualizador de Markdown — ${SITE_NAME}`,
  url: PAGE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  featureList: "markdown viewer, markdown preview, visualizar markdown online, renderizar readme, markdown para html",
};

const PLACEHOLDER = `# Título do documento

Cole seu Markdown aqui, ou arraste um arquivo **.md** para esta área.

## Recursos

- títulos, listas e citações
- tabelas e blocos de código
- [links](https://jogos.social.br) e imagens

> A prévia é atualizada enquanto você digita.`;

/** Modos de visualização do espaço de trabalho. */
const VIEWS = [
  { id: "split", label: "Lado a lado", icon: MarkdownIcon },
  { id: "preview", label: "Só prévia", icon: EyeIcon },
  { id: "source", label: "Só código", icon: PencilIcon },
];

/**
 * Documento HTML autônomo para download.
 *
 * As cores aqui são **literais** de propósito: este arquivo sai do site e vai
 * ser aberto em outro lugar, onde não existe `--fgColor-default` nem o tema por
 * cookie. Tokens resolveriam para vazio e o documento sairia sem estilo.
 */
function buildStandaloneHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0 auto; max-width: 760px; padding: 40px 20px; background: #ffffff; color: #1f2328;
         font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.6em 0 0.6em; }
  h1 { font-size: 1.9rem; } h2 { font-size: 1.5rem; } h3 { font-size: 1.25rem; }
  a { color: #7c3aed; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d9e0; padding: 6px 10px; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9em; }
  blockquote { margin: 0 0 16px; padding: 4px 16px; border-left: 3px solid #8b5cf6; color: #59636e; }
  hr { border: 0; border-top: 1px solid #d1d9e0; margin: 32px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export default function MarkdownViewerPage() {
  const [input, setInput] = useState("");
  const [view, setView] = useState("split");
  const [maximized, setMaximized] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [copied, setCopied] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const copyTimerRef = useRef(null);

  // `useDeferredValue` mantém a digitação responsiva: um documento grande é
  // re-renderizado depois, sem bloquear cada tecla. Evita o debounce manual (e
  // o `setState` dentro de efeito que o lint do projeto recusa).
  const deferredInput = useDeferredValue(input);

  const result = useMemo(() => renderMarkdown(deferredInput, { tableWrapperClass: mdBody.tableWrap }), [deferredInput]);

  const wordCount = useMemo(() => {
    const trimmed = input.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [input]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Maximizado: trava o scroll, devolve o Escape como saída e devolve o foco ao
  // botão que abriu a camada.
  useEffect(() => {
    if (!maximized) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
     * `body` não é quem rola neste layout: o scroll está em `.main-content`
     * (na folha global `css/`). Sem travá-lo também, girar o scroll sobre a
     * borda da camada — ou teclar PageDown com o foco na barra — rolava a
     * página atrás, e ao restaurar ela reaparecia em outra posição.
     */
    const scroller = document.querySelector(".main-content");
    const previousScrollerOverflow = scroller?.style.overflow ?? "";
    if (scroller) scroller.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") setMaximized(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (scroller) scroller.style.overflow = previousScrollerOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [maximized]);

  const loadFile = useCallback(async (file) => {
    if (!file) return;

    if (file.size > MAX_MARKDOWN_LENGTH) {
      setFileError(`Arquivo muito grande. O limite é ${(MAX_MARKDOWN_LENGTH / 1000).toFixed(0)} KB.`);
      return;
    }

    try {
      const text = await file.text();
      setInput(text);
      setFileName(file.name);
      setFileError(null);
    } catch {
      setFileError("Não foi possível ler o arquivo. Verifique se ele é um texto válido.");
    }
  }, []);

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      loadFile(file);
      // Permite reabrir o mesmo arquivo depois de limpá-lo.
      event.target.value = "";
    },
    [loadFile],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      loadFile(event.dataTransfer.files?.[0]);
    },
    [loadFile],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const clear = useCallback(() => {
    setInput("");
    setFileName(null);
    setFileError(null);
    setCopied(false);
  }, []);

  const copyHtml = useCallback(async () => {
    if (!result.html) return;

    try {
      await navigator.clipboard.writeText(result.html);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFileError("O navegador bloqueou a cópia. Use o download do arquivo HTML.");
    }
  }, [result.html]);

  const download = useCallback(() => {
    if (!result.html) return;
    const title = fileName ? fileName.replace(/\.[^.]+$/, "") : "documento";
    downloadBlob(new Blob([buildStandaloneHtml(title, result.html)], { type: "text/html;charset=utf-8" }), `${title}.html`);
  }, [fileName, result.html]);

  const showEditor = view !== "preview";
  const showPreview = view !== "source";
  const hasContent = input.length > 0;

  return (
    <div className={shared.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      {!maximized && (
        <PageHeader
          variant="card"
          eyebrow="Ferramentas"
          title="Visualizador Markdown"
          subtitle="Cole o texto ou abra um arquivo .md para ver o documento renderizado. A prévia atualiza enquanto você digita e nada é enviado para o servidor."
          actions={
            <Button size="small" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon size={14} />
              Abrir arquivo
            </Button>
          }
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
        className={styles.fileInput}
        onChange={handleFileChange}
        aria-label="Abrir arquivo Markdown"
      />

      <section className={maximized ? styles.workspaceMaximized : styles.workspace} aria-label="Visualizador de Markdown">
        <div className={styles.toolbar}>
          <div className={styles.modeGroup} role="group" aria-label="Modo de visualização">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={active ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
                  aria-pressed={active}
                  onClick={() => setView(item.id)}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className={styles.toolGroup}>
            {fileName ? <span className={styles.fileName}>{fileName}</span> : null}

            {maximized && (
              <span className={styles.maximizedHint}>
                <kbd>Esc</kbd> para restaurar
              </span>
            )}

            <Button size="small" variant="invisible" onClick={copyHtml} disabled={!result.html}>
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              {copied ? "Copiado" : "Copiar HTML"}
            </Button>

            <Button size="small" variant="invisible" onClick={download} disabled={!result.html}>
              <DownloadIcon size={14} />
              Baixar .html
            </Button>

            <Button size="small" variant="invisible" onClick={() => setMaximized((current) => !current)} aria-pressed={maximized}>
              {maximized ? <ScreenNormalIcon size={14} /> : <ScreenFullIcon size={14} />}
              {maximized ? "Restaurar" : "Maximizar"}
            </Button>

            <Button size="small" variant="invisible" onClick={clear} disabled={!hasContent}>
              <TrashIcon size={14} />
              Limpar
            </Button>
          </div>
        </div>

        {fileError && <p className={styles.fileErrorBox}>{fileError}</p>}

        <div className={showEditor && showPreview ? styles.panels : `${styles.panels} ${styles.panelsSingle}`}>
          {showEditor && (
            /* A área aceita arrastar arquivo: o alvo do drop é o painel inteiro,
               não só o textarea, para que soltar sobre a borda também funcione. */
            <section
              className={dragOver ? `${shared.panel} ${styles.editorPanel} ${styles.editorPanelDragOver}` : `${shared.panel} ${styles.editorPanel}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-label="Markdown de entrada"
            >
              <div className={shared.panelHeader}>
                <span className={shared.panelLabel}>Markdown</span>
                <span className={shared.charCount}>
                  {input.length > 0 ? `${input.length.toLocaleString("pt-BR")} caracteres · ${wordCount.toLocaleString("pt-BR")} palavras` : ""}
                </span>
              </div>

              <textarea
                className={`${shared.textarea} ${styles.codeArea}`}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Conteúdo Markdown"
              />

              <div className={shared.panelFooter}>
                <span className={shared.charCount}>
                  {dragOver ? "Solte o arquivo para abrir" : fileName ? `Arquivo: ${fileName}` : "Arraste um arquivo .md para esta área"}
                </span>
                <span className={shared.charCount}>{Math.min(100, Math.round((input.length / MAX_MARKDOWN_LENGTH) * 100))}% do limite</span>
              </div>
            </section>
          )}

          {showPreview && (
            <section className={`${shared.panel} ${styles.previewPanel}`} aria-label="Prévia renderizada">
              <div className={shared.panelHeader}>
                <span className={shared.panelLabel}>
                  Prévia
                  <span className={styles.renderedBadge} title="HTML gerado pelo Markdown e filtrado antes de entrar na página">
                    renderizado
                  </span>
                </span>
              </div>

              {result.error === "too-large" && (
                <div className={shared.errorBox}>Documento muito grande. O limite é {(MAX_MARKDOWN_LENGTH / 1000).toFixed(0)} KB de Markdown.</div>
              )}

              {result.html ? (
                /*
                 * O HTML passa por `lib/markdown.js`, que aplica `lib/sanitize.js`
                 * por último: `<script>`, `<style>`, `<iframe>`, `<object>`,
                 * `<embed>`, handlers `on*`, `style` inline e URLs `javascript:`
                 * não sobrevivem ao filtro. Nenhuma outra string entra aqui.
                 */
                <div className={`${mdBody.md} ${styles.markdownPane}`} dangerouslySetInnerHTML={{ __html: result.html }} />
              ) : (
                result.error !== "too-large" && <div className={shared.emptyOutput}>O documento renderizado aparecerá aqui.</div>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
