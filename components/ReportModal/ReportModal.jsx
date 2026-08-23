import { useState } from "react";
import { Dialog } from "@primer/react";
import PropTypes from "prop-types";
import styles from "./ReportModal.module.css";

// Motivos de denúncia — devem espelhar REPORT_REASONS em models/moderation.js.
const REASON_OPTIONS = [
  { value: "conteudo_ofensivo", label: "Conteúdo Ofensivo" },
  { value: "discurso_de_odio", label: "Discurso de Ódio" },
  { value: "assedio", label: "Assédio" },
  { value: "conteudo_sexual", label: "Conteúdo Sexual" },
  { value: "violencia", label: "Violência" },
  { value: "direitos_autorais", label: "Direitos Autorais" },
  { value: "dados_pessoais", label: "Dados Pessoais" },
  { value: "conteudo_improprio_menores", label: "Conteúdo Impróprio p/ Menores" },
  { value: "golpe_fraude", label: "Golpe/Fraude" },
  { value: "spam", label: "Spam" },
  { value: "outro", label: "Outro" },
];

ReportModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  error: PropTypes.string,
};

export default function ReportModal({ onClose, onSubmit, submitting, error }) {
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");

  const canSubmit = Boolean(reason) && !submitting;

  return (
    <Dialog
      title="Denunciar post"
      onClose={onClose}
      footerButtons={[
        {
          buttonType: "default",
          content: "Cancelar",
          onClick: onClose,
          disabled: submitting,
        },
        {
          buttonType: "danger",
          content: "Enviar denúncia",
          onClick: () => onSubmit(reason, justification.trim()),
          disabled: !canSubmit,
          loading: submitting,
        },
      ]}
      renderBody={() => (
        <div className={styles.body}>
          <p className={styles.hint}>Selecione o motivo da denúncia. A moderação analisará o conteúdo reportado.</p>

          {error && <p className={styles.error}>{error}</p>}

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Motivo</legend>
            <div className={styles.options}>
              {REASON_OPTIONS.map((option) => (
                <label key={option.value} className={styles.option}>
                  <input
                    type="radio"
                    name="report_reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    disabled={submitting}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={styles.justification}>
            <span className={styles.justificationLabel}>Detalhes (opcional)</span>
            <textarea
              className={styles.textarea}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Descreva brevemente o problema…"
              disabled={submitting}
            />
          </label>
        </div>
      )}
    />
  );
}
