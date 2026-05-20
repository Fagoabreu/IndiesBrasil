"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import styles from "./criar.module.css";

const EVENT_TYPES = [
  { value: "general", label: "Geral" },
  { value: "game_launch", label: "Lançamento de Jogo" },
  { value: "game_jam", label: "Game Jam" },
  { value: "stream_marathon", label: "Maratona de Stream" },
  { value: "meeting", label: "Reunião / Encontro" },
  { value: "studio", label: "Evento de Estúdio" },
];

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Público — visível para todos" },
  { value: "members", label: "Membros — apenas usuários cadastrados" },
  { value: "private", label: "Privado — apenas convidados" },
];

const FREQUENCIES = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

function toLocalDatetimeValue(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

const DEFAULT_STARTS = toLocalDatetimeValue(60);
const DEFAULT_ENDS = toLocalDatetimeValue(180);

export default function CriarEventoPage() {
  const router = useRouter();
  const { user } = useUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("general");
  const [visibility, setVisibility] = useState("public");
  const [startsAt, setStartsAt] = useState(DEFAULT_STARTS);
  const [endsAt, setEndsAt] = useState(DEFAULT_ENDS);
  const [isAllDay, setIsAllDay] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  // Recurrence rule fields
  const [frequency, setFrequency] = useState("weekly");
  const [interval, setInterval] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [untilDate, setUntilDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Banner
  const bannerFileInputRef = useRef(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerFilePreview, setBannerFilePreview] = useState(null);
  const [bannerExternalUrl, setBannerExternalUrl] = useState("");
  const [bannerMode, setBannerMode] = useState(null); // null | 'upload' | 'url'

  function handleBannerFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (bannerFilePreview) URL.revokeObjectURL(bannerFilePreview);
    setBannerFile(file);
    setBannerFilePreview(URL.createObjectURL(file));
    setBannerExternalUrl("");
    setBannerMode("upload");
  }

  function handleClearBanner() {
    if (bannerFilePreview) URL.revokeObjectURL(bannerFilePreview);
    setBannerFile(null);
    setBannerFilePreview(null);
    setBannerExternalUrl("");
    setBannerMode(null);
  }

  const toggleDay = useCallback((day) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("O título é obrigatório.");
      return;
    }

    if (isAllDay ? new Date(endsAt) < new Date(startsAt) : new Date(endsAt) <= new Date(startsAt)) {
      setError("A data de término deve ser posterior à data de início.");
      return;
    }

    const body = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      visibility,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      is_all_day: isAllDay,
      is_online: isOnline,
      online_url: isOnline && onlineUrl.trim() ? onlineUrl.trim() : null,
      location_name: !isOnline && locationName.trim() ? locationName.trim() : null,
      location_url: !isOnline && locationUrl.trim() ? locationUrl.trim() : null,
      is_recurring: isRecurring,
      banner_external_url: bannerMode === "url" && bannerExternalUrl.trim() ? bannerExternalUrl.trim() : undefined,
    };

    if (isRecurring) {
      body.recurrence_rule = {
        frequency,
        interval: Number(interval) || 1,
        days_of_week: frequency === "weekly" && daysOfWeek.length > 0 ? daysOfWeek : undefined,
        until_date: untilDate || undefined,
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Erro ao criar evento.");
        return;
      }

      if (bannerMode === "upload" && bannerFile) {
        const formData = new FormData();
        formData.append("file", bannerFile);
        await fetch(`/api/v1/events/${data.id}/banner`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      }

      router.push(`/agenda/${data.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className={styles.pageWrapper}>
        <p>
          <Link href="/login">Faça login</Link> para criar eventos.
        </p>
      </div>
    );
  }

  return (
    <>
      <SeoHead title="Criar Evento — Agenda Indies Brasil" description="Crie um novo evento na agenda da comunidade Indies Brasil." />

      <div className={styles.pageWrapper}>
        <Link href="/agenda" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Agenda
        </Link>

        <h1 className={styles.pageTitle}>Criar Evento</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Título */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">
              Título <span className={styles.required}>*</span>
            </label>
            <input
              id="title"
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre o evento..."
              maxLength={2000}
            />
          </div>

          {/* Imagem de Capa */}
          <div className={styles.field}>
            <label className={styles.label}>Imagem de Capa</label>

            <input ref={bannerFileInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleBannerFileChange} />

            {(bannerFilePreview || (bannerMode === "url" && bannerExternalUrl)) && (
              <div className={styles.bannerPreviewWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bannerFilePreview || bannerExternalUrl} alt="Preview da capa" className={styles.bannerImg} />
                <button type="button" className={styles.removeBannerBtn} onClick={handleClearBanner}>
                  Remover
                </button>
              </div>
            )}

            <div className={styles.bannerModeToggle}>
              <button
                type="button"
                className={[styles.bannerModeBtn, bannerMode === "upload" ? styles.bannerModeBtnActive : ""].join(" ")}
                onClick={() => {
                  setBannerMode("upload");
                  bannerFileInputRef.current?.click();
                }}
              >
                Upload de arquivo
              </button>
              <button
                type="button"
                className={[styles.bannerModeBtn, bannerMode === "url" ? styles.bannerModeBtnActive : ""].join(" ")}
                onClick={() => setBannerMode("url")}
              >
                Link externo
              </button>
            </div>

            {bannerMode === "url" && (
              <input
                type="url"
                className={styles.input}
                value={bannerExternalUrl}
                onChange={(e) => setBannerExternalUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            )}

            <span className={styles.hint}>Opcional — imagem exibida no topo da página do evento.</span>
          </div>

          {/* Tipo e Visibilidade */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="eventType">
                Tipo <span className={styles.required}>*</span>
              </label>
              <select id="eventType" className={styles.select} value={eventType} onChange={(e) => setEventType(e.target.value)}>
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
              <select id="visibility" className={styles.select} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
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

          {/* Dia inteiro */}
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
            <span className={styles.checkboxLabel}>Evento de dia inteiro</span>
          </label>

          {/* Datas */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="startsAt">
                Início <span className={styles.required}>*</span>
              </label>
              <input
                id="startsAt"
                type={isAllDay ? "date" : "datetime-local"}
                className={styles.input}
                value={isAllDay ? startsAt.slice(0, 10) : startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="endsAt">
                Término <span className={styles.required}>*</span>
              </label>
              <input
                id="endsAt"
                type={isAllDay ? "date" : "datetime-local"}
                className={styles.input}
                value={isAllDay ? endsAt.slice(0, 10) : endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </div>
          </div>

          <hr className={styles.divider} />
          <p className={styles.sectionTitle}>Local</p>

          {/* Online toggle */}
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
            <span className={styles.checkboxLabel}>Evento online</span>
          </label>

          {isOnline && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="onlineUrl">
                Link do evento
              </label>
              <input
                id="onlineUrl"
                type="url"
                className={styles.input}
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                placeholder="https://..."
              />
              <span className={styles.hint}>Pode ser deixado em branco e divulgado depois.</span>
            </div>
          )}

          {!isOnline && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="locationName">
                  Nome do local
                </label>
                <input
                  id="locationName"
                  type="text"
                  className={styles.input}
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
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
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          )}

          <hr className={styles.divider} />
          <p className={styles.sectionTitle}>Recorrência</p>

          {/* Recorrente toggle */}
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            <span className={styles.checkboxLabel}>Evento recorrente</span>
          </label>

          {isRecurring && (
            <div className={styles.recurrenceBox}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="frequency">
                    Frequência
                  </label>
                  <select id="frequency" className={styles.select} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
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
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    min={1}
                    max={52}
                  />
                  <span className={styles.hint}>Ex: 2 = a cada 2 semanas</span>
                </div>
              </div>

              {frequency === "weekly" && (
                <fieldset className={styles.field} style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className={styles.label}>Dias da semana</legend>
                  <div className={styles.daysGrid}>
                    {WEEK_DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        className={[styles.dayToggle, daysOfWeek.includes(d.value) ? styles.active : ""].filter(Boolean).join(" ")}
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
                <input id="untilDate" type="date" className={styles.input} value={untilDate} onChange={(e) => setUntilDate(e.target.value)} />
                <span className={styles.hint}>Deixe em branco para gerar ocorrências por 12 meses.</span>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className={styles.actions}>
            <Link href="/agenda" className={styles.cancelBtn}>
              Cancelar
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? <Spinner size="small" /> : "Criar Evento"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
