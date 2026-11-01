"use client";
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { AI_USAGE_LEVELS, MAX_AI_NOTES_LENGTH, formatAiLevelLabel } from "@/lib/ai-usage";
import styles from "./AiUsageModal.module.css";

/**
 * Declaração do nível de uso de IA de um produto.
 *
 * Diferente do modal de classificação indicativa, aqui não há questionário: a
 * declaração é direta — a pessoa escolhe o nível e, se quiser, explica em que a
 * IA entrou (ferramentas, etapas, o que foi gerado). Quem classifica é quem
 * pode editar o produto; a rota recusa o resto.
 *
 * `initialLevel`/`initialNotes` vêm da leitura do produto (`ai_level`), então
 * reabrir o modal mostra o que já foi declarado em vez de começar do zero.
 */
export default function AiUsageModal({ type, slug, itemName, initialLevel = null, initialNotes = "", onClose }) {
  const [level, setLevel] = useState(initialLevel === null || initialLevel === undefined ? "" : String(initialLevel));
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (level === "") {
      setError("Escolha um nível para declarar.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/ai-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, slug, level: Number(level), notes }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Não foi possível salvar a classificação.");
        return;
      }

      onClose(true);
    } catch {
      setError("Não foi possível salvar a classificação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={() => onClose(false)}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ai-usage-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 id="ai-usage-title" className={styles.title}>
              Uso de IA
            </h2>
            <p className={styles.description}>{itemName}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={() => onClose(false)} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <p className={styles.intro}>
              Informe quanto de inteligência artificial entrou na obra. A declaração aparece no card, na página do produto e nos filtros de listagem.
            </p>

            <fieldset className={styles.levelFieldset}>
              <legend className={styles.legend}>Nível de uso de IA</legend>

              {AI_USAGE_LEVELS.map((item) => (
                <label
                  key={item.level}
                  className={`${styles.levelCard} ${styles[item.tone]} ${level === String(item.level) ? styles.levelCardSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="ai-level"
                    value={String(item.level)}
                    checked={level === String(item.level)}
                    onChange={() => setLevel(String(item.level))}
                    className={styles.radio}
                  />
                  <span className={styles.levelSymbol} aria-hidden="true">
                    {item.symbol ?? item.level}
                  </span>
                  <span className={styles.levelInfo}>
                    <span className={styles.levelName}>{formatAiLevelLabel(item.level)}</span>
                    <span className={styles.levelDesc}>{item.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className={styles.notesField}>
              <span className={styles.notesLabel}>Detalhes (opcional)</span>
              <textarea
                className={styles.textarea}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={MAX_AI_NOTES_LENGTH}
                rows={3}
                placeholder="Ferramentas usadas, etapas em que a IA entrou, o que foi gerado e o que foi feito à mão…"
              />
              <span className={styles.notesHint}>
                {notes.length}/{MAX_AI_NOTES_LENGTH} caracteres
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.btn} onClick={() => onClose(false)} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving || level === ""}>
              {saving ? "Salvando…" : "Salvar classificação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

AiUsageModal.propTypes = {
  type: PropTypes.oneOf(["game", "boardgame", "book", "asset"]).isRequired,
  slug: PropTypes.string.isRequired,
  itemName: PropTypes.string,
  initialLevel: PropTypes.number,
  initialNotes: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
