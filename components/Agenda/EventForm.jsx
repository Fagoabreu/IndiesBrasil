"use client";
import { useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { Spinner } from "@primer/react";
import AddressFormFields from "@/components/Address/AddressFormFields";
import EventBannerField, { EMPTY_BANNER } from "./EventBannerField";
import styles from "./EventForm.module.css";
import { EVENT_TYPES, VISIBILITY_OPTIONS, FREQUENCIES, WEEK_DAYS, buildEventPayload, validateEvent } from "./eventFormOptions";

/**
 * Formulário de evento, usado tanto na criação quanto na edição.
 *
 * O que muda entre os dois fluxos é declarado por props (`mode`,
 * `enableRecurrence`, `submitLabel`) e o que é específico de API fica com a
 * página, através de `onSubmit`. As duas telas antes eram cópias uma da outra
 * e já tinham divergido — daí a extração.
 */
export default function EventForm({
  mode,
  initialValues,
  initialBannerUrl,
  enableRecurrence = false,
  error,
  submitting,
  onSubmit,
  cancelHref,
  submitLabel,
}) {
  const [values, setValues] = useState(initialValues);
  const [banner, setBanner] = useState(EMPTY_BANNER);
  const [validationError, setValidationError] = useState(null);

  function setField(field, fieldValue) {
    setValues((prev) => ({ ...prev, [field]: fieldValue }));
  }

  function toggleDay(day) {
    setValues((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day) ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setValidationError(null);

    const message = validateEvent(values);
    if (message) {
      setValidationError(message);
      return;
    }

    await onSubmit({ payload: buildEventPayload(values, { mode }), banner });
  }

  const shownError = validationError || error;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {shownError && <div className={styles.error}>{shownError}</div>}

      {/* Título */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Título <span className={styles.required}>*</span>
        </label>
        <input
          id="title"
          type="text"
          className={styles.input}
          value={values.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="Ex: RetroConfer 2026"
          maxLength={255}
          required
        />
      </div>

      {/* Descrição */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Descrição
        </label>
        <textarea
          id="description"
          className={styles.textarea}
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Detalhes sobre o evento..."
          maxLength={2000}
        />
      </div>

      {/* Imagem de Capa — fieldset porque o grupo tem três controles (upload,
          link e remover) e um <label> só poderia apontar para um deles. */}
      <fieldset className={styles.field}>
        <legend className={styles.label}>Imagem de Capa</legend>

        <EventBannerField value={banner} onChange={setBanner} savedUrl={initialBannerUrl} disabled={submitting} />

        <span className={styles.hint}>
          Opcional — imagem exibida no topo da página do evento. O arquivo enviado passa por recorte para se ajustar a esse espaço.
        </span>
      </fieldset>

      {/* Tipo e Visibilidade */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="eventType">
            Tipo <span className={styles.required}>*</span>
          </label>
          <select id="eventType" className={styles.select} value={values.eventType} onChange={(e) => setField("eventType", e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="visibility">
            Visibilidade
          </label>
          <select id="visibility" className={styles.select} value={values.visibility} onChange={(e) => setField("visibility", e.target.value)}>
            {VISIBILITY_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <hr className={styles.divider} />
      <p className={styles.sectionTitle}>Data e Horário</p>

      <label className={styles.checkboxField}>
        <input type="checkbox" checked={values.isAllDay} onChange={(e) => setField("isAllDay", e.target.checked)} />
        <span className={styles.checkboxLabel}>Evento de dia inteiro</span>
      </label>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="startsAt">
            Início <span className={styles.required}>*</span>
          </label>
          <input
            id="startsAt"
            type={values.isAllDay ? "date" : "datetime-local"}
            className={styles.input}
            value={values.isAllDay ? values.startsAt.slice(0, 10) : values.startsAt}
            onChange={(e) => setField("startsAt", e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="endsAt">
            Término <span className={styles.required}>*</span>
          </label>
          <input
            id="endsAt"
            type={values.isAllDay ? "date" : "datetime-local"}
            className={styles.input}
            value={values.isAllDay ? values.endsAt.slice(0, 10) : values.endsAt}
            onChange={(e) => setField("endsAt", e.target.value)}
            required
          />
        </div>
      </div>

      <hr className={styles.divider} />
      <p className={styles.sectionTitle}>Local</p>

      <label className={styles.checkboxField}>
        <input type="checkbox" checked={values.isOnline} onChange={(e) => setField("isOnline", e.target.checked)} />
        <span className={styles.checkboxLabel}>Evento online</span>
      </label>

      {values.isOnline && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="onlineUrl">
            Link do evento
          </label>
          <input
            id="onlineUrl"
            type="url"
            className={styles.input}
            value={values.onlineUrl}
            onChange={(e) => setField("onlineUrl", e.target.value)}
            placeholder="https://..."
          />
          <span className={styles.hint}>Pode ser deixado em branco e divulgado depois.</span>
        </div>
      )}

      {!values.isOnline && (
        <>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="locationName">
                Nome do local
              </label>
              <input
                id="locationName"
                type="text"
                className={styles.input}
                value={values.locationName}
                onChange={(e) => setField("locationName", e.target.value)}
                placeholder="Ex: Centro de Convenções"
                maxLength={255}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="locationUrl">
                Link do local (mapa)
              </label>
              <input
                id="locationUrl"
                type="url"
                className={styles.input}
                value={values.locationUrl}
                onChange={(e) => setField("locationUrl", e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>

          <p className={styles.sectionTitle} style={{ marginTop: 8 }}>
            Endereço
          </p>
          <AddressFormFields
            value={values.address}
            onChange={(field, value) => setField("address", { ...values.address, [field]: value })}
            disabled={submitting}
          />
        </>
      )}

      <hr className={styles.divider} />

      {/* Link para ingressos */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="ticketUrl">
          Link para ingressos
        </label>
        <input
          id="ticketUrl"
          type="url"
          className={styles.input}
          value={values.ticketUrl}
          onChange={(e) => setField("ticketUrl", e.target.value)}
          placeholder="https://..."
        />
        <span className={styles.hint}>Opcional — link externo para compra de ingressos (Sympla, Eventbrite, etc.)</span>
      </div>

      {enableRecurrence && (
        <>
          <hr className={styles.divider} />
          <p className={styles.sectionTitle}>Recorrência</p>

          <label className={styles.checkboxField}>
            <input type="checkbox" checked={values.isRecurring} onChange={(e) => setField("isRecurring", e.target.checked)} />
            <span className={styles.checkboxLabel}>Evento recorrente</span>
          </label>

          {values.isRecurring && (
            <div className={styles.recurrenceBox}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="frequency">
                    Frequência
                  </label>
                  <select id="frequency" className={styles.select} value={values.frequency} onChange={(e) => setField("frequency", e.target.value)}>
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="interval">
                    A cada (intervalo)
                  </label>
                  <input
                    id="interval"
                    type="number"
                    className={styles.input}
                    value={values.interval}
                    onChange={(e) => setField("interval", e.target.value)}
                    min={1}
                    max={52}
                  />
                  <span className={styles.hint}>Ex: 2 = a cada 2 semanas</span>
                </div>
              </div>

              {values.frequency === "weekly" && (
                <fieldset className={styles.field} style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className={styles.label}>Dias da semana</legend>
                  <div className={styles.daysGrid}>
                    {WEEK_DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        className={[styles.dayToggle, values.daysOfWeek.includes(d.value) ? styles.dayToggleActive : ""].filter(Boolean).join(" ")}
                        onClick={() => toggleDay(d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <span className={styles.hint}>Deixe em branco para usar o dia de início.</span>
                </fieldset>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="untilDate">
                  Encerrar em (opcional)
                </label>
                <input
                  id="untilDate"
                  type="date"
                  className={styles.input}
                  value={values.untilDate}
                  onChange={(e) => setField("untilDate", e.target.value)}
                />
                <span className={styles.hint}>Deixe em branco para gerar ocorrências por 12 meses.</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ações */}
      <div className={styles.actions}>
        <Link href={cancelHref} className={styles.cancelBtn}>
          Cancelar
        </Link>
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? <Spinner size="small" /> : submitLabel}
        </button>
      </div>
    </form>
  );
}

EventForm.propTypes = {
  mode: PropTypes.oneOf(["create", "edit"]).isRequired,
  /** Valores iniciais do formulário (ver `emptyEventValues` / `eventValuesFromApi`). */
  initialValues: PropTypes.object.isRequired,
  initialBannerUrl: PropTypes.string,
  enableRecurrence: PropTypes.bool,
  error: PropTypes.string,
  submitting: PropTypes.bool.isRequired,
  /** ({ payload, banner }) => Promise<void> */
  onSubmit: PropTypes.func.isRequired,
  cancelHref: PropTypes.string.isRequired,
  submitLabel: PropTypes.string.isRequired,
};
