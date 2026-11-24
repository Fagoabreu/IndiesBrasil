import { useState } from "react";
import styles from "./MeetingCreateForm.module.css";
import { defaultMeetingWindow, meetingInputToInstant } from "@/lib/meetingFormat";

export default function MeetingCreateForm({ slug, onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Início = **agora** (no fuso de reuniões) e término = +1h. Calculado na
  // abertura do formulário, não no import do módulo: a página pode ficar aberta
  // por horas e o campo nascia com o horário do carregamento (no passado).
  const [startsAt, setStartsAt] = useState(() => defaultMeetingWindow().startsAt);
  const [endsAt, setEndsAt] = useState(() => defaultMeetingWindow().endsAt);
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    if (!title.trim()) return "Informe o título da reunião.";
    if (!startsAt || !endsAt) return "Informe as datas de início e término.";
    // Comparação por instante: os valores do input são hora de parede de
    // Brasília, e `new Date(valor)` os leria no fuso do navegador.
    if (meetingInputToInstant(endsAt) <= meetingInputToInstant(startsAt)) {
      return "O término deve ser posterior ao início.";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}/meetings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          starts_at: meetingInputToInstant(startsAt).toISOString(),
          ends_at: meetingInputToInstant(endsAt).toISOString(),
          max_participants: maxParticipants ? Number(maxParticipants) : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Erro ao criar reunião.");
        return;
      }

      setTitle("");
      setDescription("");
      setMaxParticipants("");
      // "Agora" mudou: recalcular em vez de reaproveitar o valor da abertura.
      const next = defaultMeetingWindow();
      setStartsAt(next.startsAt);
      setEndsAt(next.endsAt);
      if (onCreated) onCreated(data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.formTitle}>Agendar nova reunião</h2>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-title">
          Título <span className={styles.required}>*</span>
        </label>
        <input
          id="meeting-title"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Reunião de pauta semanal"
          maxLength={120}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-description">
          Descrição
        </label>
        <textarea
          id="meeting-description"
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Pauta, objetivos ou link de apoio (opcional)"
          maxLength={1000}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="meeting-starts">
            Início <span className={styles.required}>*</span>
          </label>
          <input id="meeting-starts" type="datetime-local" className={styles.input} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="meeting-ends">
            Término <span className={styles.required}>*</span>
          </label>
          <input
            id="meeting-ends"
            type="datetime-local"
            className={styles.input}
            // O seletor nativo já não oferece um término anterior ao início. O
            // início pode ser movido para depois do término já escolhido — aí
            // quem barra é o `validate()` acima, com mensagem.
            min={startsAt || undefined}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-max">
          Limite de participantes (opcional)
        </label>
        <input
          id="meeting-max"
          type="number"
          min="1"
          className={styles.input}
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          placeholder="Sem limite"
          style={{ maxWidth: 180 }}
        />
      </div>

      <div className={styles.actions}>
        {onCancel && (
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className={styles.submitBtn} type="submit" disabled={submitting}>
          {submitting ? "Agendando…" : "Agendar reunião"}
        </button>
      </div>
    </form>
  );
}
