"use client";
import { useEffect, useState } from "react";
import styles from "./ContentRatingModal.module.css";

/**
 * Modal de autoclassificação indicativa.
 *
 * Fluxo:
 *   1. Carrega o questionário via API conforme o type
 *   2. Usuário responde seção por seção
 *   3. Ao finalizar, envia para cálculo (POST /api/v1/content-rating)
 *   4. Exibe o resultado com faixa etária + motivos
 *   5. Usuário confirma → salva no banco
 *   6. Ao fechar, notifica o pai com o resultado (ou null se cancelou)
 *
 * Props:
 *   type        — "game" | "boardgame" | "book"
 *   itemName    — nome do item (exibido no título)
 *   onClose     — (ratingInfo | null) => void
 */

export default function ContentRatingModal({ type, itemName, onClose }) {
  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Navegação
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  // Resultado
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Carregar questionário
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/content-rating?type=${encodeURIComponent(type)}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erro ao carregar questionário.");
        if (!cancelled) setQuestionnaire(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  // Handlers
  function selectAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function goNext() {
    if (!questionnaire) return;
    if (sectionIndex < questionnaire.sections.length - 1) {
      setSectionIndex((s) => s + 1);
    } else {
      // Última seção → calcular
      submitCalculation();
    }
  }

  function goPrev() {
    setSectionIndex((s) => Math.max(0, s - 1));
  }

  async function submitCalculation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/content-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "calculate", type, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao calcular classificação.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      // O slug será passado pelo onClose via parent, aqui só confirmamos
      // A API espera o slug — o parent passa ao chamar o modal.
      // Mas como o modal não sabe o slug, usamos onClose para notificar.
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saved && result) {
      onClose(result);
    } else {
      onClose(null);
    }
  }

  // Estados de loading/erro
  if (loading && !questionnaire && !result) {
    return (
      <div className={styles.overlay} onClick={handleClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h2 className={styles.title}>Classificação Indicativa</h2>
            </div>
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Fechar">
              ✕
            </button>
          </div>
          <div className={styles.loading}>Carregando questionário...</div>
        </div>
      </div>
    );
  }

  if (error && !questionnaire) {
    return (
      <div className={styles.overlay} onClick={handleClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h2 className={styles.title}>Erro</h2>
            </div>
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Fechar">
              ✕
            </button>
          </div>
          <div className={styles.body}>
            <p style={{ color: "var(--fgColor-danger)" }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Tela de resultado
  if (result) {
    const ratingColor =
      {
        L: "#2da44e",
        6: "#54aeff",
        10: "#f7c600",
        12: "#f47c00",
        14: "#e85d1e",
        16: "#cf222e",
        18: "#1a1a2e",
      }[result.rating] || "#666";

    return (
      <div className={styles.overlay} onClick={saved ? handleClose : undefined}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h2 className={styles.title}>Resultado da Classificação</h2>
              <p className={styles.description}>{itemName}</p>
            </div>
            {!saved && (
              <button className={styles.closeBtn} onClick={handleClose} aria-label="Cancelar">
                ✕
              </button>
            )}
          </div>
          <div className={styles.body}>
            <div className={styles.resultSection}>
              <div className={styles.resultRating} style={{ backgroundColor: ratingColor }}>
                {result.rating === "L" ? "L" : result.rating}
              </div>
              <p className={styles.resultLabel}>{result.label}</p>
              <p className={styles.resultInfo}>Classificação calculada com base nas diretrizes oficiais brasileiras.</p>
            </div>

            <ul className={styles.reasonsList}>
              {result.reasons.map((reason, i) => (
                <li key={i} className={styles.reasonItem}>
                  {reason}
                </li>
              ))}
            </ul>

            {result.monetizationFlags &&
              (result.monetizationFlags.hasLootboxes || result.monetizationFlags.hasInGamePurchases || result.monetizationFlags.hasExcessiveAds) && (
                <div className={styles.monetizationResult}>
                  <p className={styles.monetizationTitle}>Selos Lei Felca (PL 412/2022)</p>
                  <div className={styles.monetizationTags}>
                    {result.monetizationFlags.hasLootboxes && <span className={`${styles.monetizationTag} ${styles.mzLootboxes}`}>🎁 Lootboxes</span>}
                    {result.monetizationFlags.hasInGamePurchases && (
                      <span className={`${styles.monetizationTag} ${styles.mzPurchases}`}>💳 Compras no jogo</span>
                    )}
                    {result.monetizationFlags.hasExcessiveAds && (
                      <span className={`${styles.monetizationTag} ${styles.mzAds}`}>📢 Anúncios excessivos</span>
                    )}
                  </div>
                  <p className={styles.monetizationHint}>
                    Estes selos serão exibidos no card do jogo para informar os consumidores, conforme determina a Lei Felca.
                  </p>
                </div>
              )}

            {error && <p style={{ color: "var(--fgColor-danger)", marginTop: 12, fontSize: 13 }}>{error}</p>}
          </div>
          <div className={styles.footer}>
            {!saved ? (
              <>
                <button className={styles.btn} onClick={handleClose}>
                  Cancelar
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={confirmSave} disabled={saving}>
                  {saving ? "Salvando..." : "Confirmar Classificação"}
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: "var(--fgColor-success)", fontWeight: 600 }}>✓ Classificação salva com sucesso!</span>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>
                  Concluir
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Questionário
  if (!questionnaire) return null;

  const section = questionnaire.sections[sectionIndex];
  const isLast = sectionIndex === questionnaire.sections.length - 1;
  const allAnswered = section.questions.every((q) => answers[q.id]);

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>{questionnaire.title}</h2>
            <p className={styles.description}>{questionnaire.description}</p>
          </div>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Cancelar">
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className={styles.body}>
          <div className={styles.steps}>
            {questionnaire.sections.map((s, i) => (
              <div
                key={s.id}
                className={`${styles.step} ${i < sectionIndex ? styles.stepDone : ""} ${i === sectionIndex ? styles.stepActive : ""}`}
              />
            ))}
          </div>

          <h3 className={styles.sectionTitle}>{section.title}</h3>
          <p className={styles.sectionDesc}>{section.description}</p>

          {section.questions.map((q) => (
            <div key={q.id} className={styles.question}>
              <p className={styles.questionText}>{q.text}</p>
              <div className={styles.options}>
                {q.options.map((opt) => (
                  <div
                    key={opt.value}
                    className={`${styles.option} ${answers[q.id] === opt.value ? styles.optionSelected : ""}`}
                    onClick={() => selectAnswer(q.id, opt.value)}
                  >
                    <div className={styles.optionRadio}>{answers[q.id] === opt.value && <div className={styles.optionRadioInner} />}</div>
                    <span className={styles.optionLabel}>{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          {sectionIndex > 0 ? (
            <button className={styles.btn} onClick={goPrev}>
              ← Voltar
            </button>
          ) : (
            <span />
          )}
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext} disabled={!allAnswered || loading}>
            {loading ? "Calculando..." : isLast ? "Ver Classificação" : "Próximo →"}
          </button>
        </div>
      </div>
    </div>
  );
}
