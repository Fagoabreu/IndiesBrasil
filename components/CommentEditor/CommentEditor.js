"use client";
import { useRef, useState } from "react";
import { Textarea } from "@primer/react";
import { BoldIcon, ItalicIcon, CodeIcon, LinkIcon, EyeIcon, EyeClosedIcon, SmileyIcon, TypographyIcon, InfoIcon } from "@primer/octicons-react";
import { markdownToHtml } from "@/utils/markdown";
import styles from "./CommentEditor.module.css";

// Handler puro de DOM — não depende de estado/props do componente
function handlePreviewClick(e) {
  const spoiler = e.target.closest(".spoiler");
  if (!spoiler) return;
  spoiler.classList.toggle("revealed");
  if (e.target.tagName === "A" && !spoiler.classList.contains("revealed")) {
    e.preventDefault();
  }
}

// Keyboard handler para a div de preview (acessibilidade)
function handlePreviewKeyDown(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    handlePreviewClick(e);
  }
}

const EMOJIS = [
  "😀",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😎",
  "🤩",
  "😢",
  "😡",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🔥",
  "⭐",
  "💯",
  "❤️",
  "💔",
  "🎉",
  "✨",
  "🤔",
  "💡",
  "📌",
  "🚀",
  "✅",
  "❌",
  "⚠️",
  "ℹ️",
  "🎮",
  "🕹️",
  "🎲",
  "📝",
  "💬",
  "🗨️",
];

export default function CommentEditor({ value, onChange, onSubmit, onCancel, submitting, placeholder }) {
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const textareaRef = useRef(null);

  function insertAtCursor(before, after = "") {
    // O forwardRef do Primer Textarea aponta diretamente para o <textarea> nativo
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const newText = value.slice(0, start) + before + selected + after + value.slice(end);

    onChange(newText);

    // Restaura cursor após o React re-renderizar com o novo value
    setTimeout(() => {
      const pos = selected ? start + before.length + selected.length + after.length : start + before.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    }, 0);
  }

  function handleKeyDown(e) {
    // Ctrl+Enter / Cmd+Enter submete
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit(e);
    }
  }

  function handleToggleLivePreview() {
    setShowLivePreview((p) => !p);
    if (!showLivePreview) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }

  function handleInsertEmoji(emoji) {
    insertAtCursor(emoji);
    setShowEmoji(false);
  }

  const previewHtml = markdownToHtml(value);

  return (
    <div className={styles.editor}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          <button
            type="button"
            className={`${styles.tbBtn} ${showFormatting ? styles.tbBtnActive : ""}`}
            onClick={() => setShowFormatting((v) => !v)}
            title="Formatação de texto"
            aria-label="Formatação de texto"
          >
            <TypographyIcon size={14} />
          </button>

          {showFormatting && (
            <>
              <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("**", "**")} title="Negrito" aria-label="Negrito">
                <BoldIcon size={14} />
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("*", "*")} title="Itálico" aria-label="Itálico">
                <ItalicIcon size={14} />
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("~~", "~~")} title="Tachado" aria-label="Tachado">
                <span className={styles.tbStrike}>S</span>
              </button>
              <button
                type="button"
                className={styles.tbBtn}
                onClick={() => insertAtCursor("`", "`")}
                title="Código inline"
                aria-label="Código inline"
              >
                <CodeIcon size={14} />
              </button>
              <button
                type="button"
                className={styles.tbBtn}
                onClick={() => insertAtCursor("\n```\n", "\n```\n")}
                title="Bloco de código"
                aria-label="Bloco de código"
              >
                <span className={styles.tbCodeBlock}>{"</>"}</span>
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("[", "](url)")} title="Link" aria-label="Link">
                <LinkIcon size={14} />
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("||", "||")} title="Spoiler" aria-label="Spoiler">
                <EyeClosedIcon size={14} />
              </button>
            </>
          )}

          <div className={styles.emojiWrap}>
            <button
              type="button"
              className={`${styles.tbBtn} ${showEmoji ? styles.tbBtnActive : ""}`}
              onClick={() => setShowEmoji((v) => !v)}
              title="Emoji"
              aria-label="Emoji"
            >
              <SmileyIcon size={14} />
            </button>
            {showEmoji && (
              <div className={styles.emojiPicker}>
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" className={styles.emojiBtn} onClick={() => handleInsertEmoji(emoji)} title={emoji}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.toolbarEnd}>
          <div className={styles.helpWrap}>
            <button
              type="button"
              className={`${styles.tbBtn} ${showHelp ? styles.tbBtnActive : ""}`}
              onClick={() => setShowHelp((v) => !v)}
              title="Ajuda de formatação"
              aria-label="Ajuda de formatação"
            >
              <InfoIcon size={14} />
            </button>
            {showHelp && (
              <div className={styles.helpPopover}>
                <p className={styles.helpTitle}>Atalhos de Markdown</p>
                <ul className={styles.helpList}>
                  <li>
                    <code>**texto**</code> → <strong>negrito</strong>
                  </li>
                  <li>
                    <code>*texto*</code> → <em>itálico</em>
                  </li>
                  <li>
                    <code>~~texto~~</code> → <del>tachado</del>
                  </li>
                  <li>
                    <code>`código`</code> → código inline
                  </li>
                  <li>
                    <code>```bloco```</code> → bloco de código
                  </li>
                  <li>
                    <code>[texto](url)</code> → link
                  </li>
                  <li>
                    <code>||spoiler||</code> → spoiler
                  </li>
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`${styles.tbBtn} ${showLivePreview ? styles.tbBtnActive : ""}`}
            onClick={handleToggleLivePreview}
            title={showLivePreview ? "Ocultar pré-visualização" : "Mostrar pré-visualização ao vivo"}
            aria-label={showLivePreview ? "Ocultar pré-visualização" : "Mostrar pré-visualização ao vivo"}
          >
            {showLivePreview ? <EyeIcon size={14} /> : <EyeClosedIcon size={14} />}
          </button>
        </div>
      </div>

      {/* Input — always visible */}
      <Textarea
        ref={textareaRef}
        placeholder={placeholder || "Escreva usando Markdown..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        resize="vertical"
        block
      />

      {/* Live preview — below textarea, toggleable */}
      {showLivePreview && (
        <div // NOSONAR
          className={styles.livePreview}
          onClick={handlePreviewClick}
          onKeyDown={handlePreviewKeyDown}
          /* dangerouslySetInnerHTML: markdown convertido para HTML com
           * sanitização de tags. Conteúdo vindo de usuário autenticado. */
          dangerouslySetInnerHTML={{
            __html: previewHtml || '<em style="color:var(--fgColor-muted);font-style:italic">Nada para pré-visualizar</em>',
          }}
        />
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerKbd}>
          <kbd>Ctrl+Enter</kbd> para enviar
        </span>
        <div className={styles.footerActions}>
          {onCancel && (
            <button type="button" className={styles.footerCancelBtn} onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
          )}
          {onSubmit && (
            <button type="button" className={styles.footerBtn} disabled={!value.trim() || submitting} onClick={onSubmit}>
              {submitting ? "Enviando..." : "Comentar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
