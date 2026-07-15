"use client";
import { useRef, useState } from "react";
import { Textarea } from "@primer/react";
import { BoldIcon, ItalicIcon, CodeIcon, LinkIcon, EyeIcon, EyeClosedIcon, PencilIcon, SmileyIcon } from "@primer/octicons-react";
import { markdownToHtml } from "@/utils/markdown";
import styles from "./CommentEditor.module.css";

/* =========================================================
 * Emoji set — curadoria para comunidade dev/gamedev
 * ========================================================= */
const EMOJIS = [
  "😀",
  "😂",
  "🤣",
  "😍",
  "🤩",
  "😎",
  "🤔",
  "😅",
  "😢",
  "😤",
  "👍",
  "👎",
  "👏",
  "🙌",
  "💪",
  "🤝",
  "🎉",
  "🔥",
  "💯",
  "✅",
  "❌",
  "⚠️",
  "ℹ️",
  "💡",
  "📌",
  "🔗",
  "💻",
  "🖥️",
  "⌨️",
  "🖱️",
  "🎮",
  "🕹️",
  "📱",
  "🔧",
  "⚙️",
  "🛠️",
  "🐛",
  "🚀",
  "📦",
  "🗂️",
  "📁",
  "📄",
  "🧩",
  "🎨",
  "🎵",
  "🎬",
  "🎲",
  "♟️",
  "🎯",
  "🏆",
  "⭐",
  "🌟",
  "✨",
  "💎",
  "🏗️",
  "🎪",
  "☕",
  "🐍",
  "🦀",
  "🐘",
  "💚",
];

export default function CommentEditor({ value, onChange, onSubmit, submitting, placeholder }) {
  const [preview, setPreview] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
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

  function handlePreviewClick(e) {
    // Event delegation para spoilers renderizados via dangerouslySetInnerHTML
    const spoiler = e.target.closest(".spoiler");
    if (!spoiler) return;
    spoiler.classList.toggle("revealed");
    // Se havia um link dentro do spoiler escondido, impede navegação no primeiro clique
    if (e.target.tagName === "A" && !spoiler.classList.contains("revealed")) {
      e.preventDefault();
    }
  }

  const previewHtml = markdownToHtml(value);

  return (
    <div className={styles.editor}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.tbGroup}>
          <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("**", "**")} title="Negrito (Ctrl+B)" aria-label="Negrito">
            <BoldIcon size={14} />
          </button>
          <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("*", "*")} title="Itálico (Ctrl+I)" aria-label="Itálico">
            <ItalicIcon size={14} />
          </button>
          <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("~~", "~~")} title="Tachado (~~texto~~)" aria-label="Tachado">
            <span className={styles.tbStrike}>S</span>
          </button>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => insertAtCursor("`", "`")}
            title="Código inline (`código`)"
            aria-label="Código inline"
          >
            <CodeIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => insertAtCursor("\n```\n", "\n```\n")}
            title={"Bloco de código (```bloco```)"}
            aria-label="Bloco de código"
          >
            <span className={styles.tbCodeBlock}>{"</>"}</span>
          </button>
          <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("[", "](url)")} title="Link ([texto](url))" aria-label="Link">
            <LinkIcon size={14} />
          </button>
          <button type="button" className={styles.tbBtn} onClick={() => insertAtCursor("||", "||")} title="Spoiler (||texto||)" aria-label="Spoiler">
            <EyeClosedIcon size={14} />
          </button>
        </div>

        <div className={styles.tbGroup}>
          {/* Emoji picker */}
          <div className={styles.emojiWrap}>
            <button
              type="button"
              className={`${styles.tbBtn} ${showEmoji ? styles.tbBtnActive : ""}`}
              onClick={() => setShowEmoji((p) => !p)}
              title="Emoji"
              aria-label="Emoji"
            >
              <SmileyIcon size={14} />
            </button>
            {showEmoji && (
              <div className={styles.emojiPicker}>
                <div className={styles.emojiGrid}>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={styles.emojiBtn}
                      onClick={() => {
                        insertAtCursor(emoji);
                        setShowEmoji(false);
                      }}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview toggle */}
          <button
            type="button"
            className={`${styles.tbBtn} ${preview ? styles.tbBtnActive : ""}`}
            onClick={() => setPreview((p) => !p)}
            title={preview ? "Editar" : "Pré-visualizar"}
            aria-label={preview ? "Editar" : "Pré-visualizar"}
          >
            {preview ? <PencilIcon size={14} /> : <EyeIcon size={14} />}
          </button>
        </div>
      </div>

      {/* Input / Preview */}
      {preview ? (
        <div
          className={styles.preview}
          onClick={handlePreviewClick}
          /* dangerouslySetInnerHTML: markdown convertido para HTML com
           * sanitização de tags. Conteúdo vindo de usuário autenticado. */
          dangerouslySetInnerHTML={{
            __html: previewHtml || '<em style="color:var(--fgColor-muted);font-style:italic">Nada para pré-visualizar</em>',
          }}
        />
      ) : (
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
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          Markdown: **negrito** *itálico* ~~tachado~~ `código` ```bloco``` [link](url). Ctrl+Enter para enviar.
        </span>
        {onSubmit && (
          <button type="button" className={styles.footerBtn} disabled={!value.trim() || submitting} onClick={onSubmit}>
            {submitting ? "Enviando..." : "Comentar"}
          </button>
        )}
      </div>
    </div>
  );
}
