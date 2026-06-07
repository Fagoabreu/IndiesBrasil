import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import AddressFormFields from "@/components/Address/AddressFormFields";
import styles from "./editar.module.css";

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

function toDatetimeLocal(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function toDateOnly(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toISOString().slice(0, 10);
}

export default function EditarEventoPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("general");
  const [visibility, setVisibility] = useState("public");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
    country: "Brasil",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Banner
  const bannerFileInputRef = useRef(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState(null);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerUrlInput, setBannerUrlInput] = useState("");

  const populateForm = useCallback((ev) => {
    setTitle(ev.title || "");
    setDescription(ev.description || "");
    setEventType(ev.event_type || "general");
    setVisibility(ev.visibility || "public");
    setIsAllDay(ev.is_all_day || false);
    setIsOnline(ev.is_online || false);
    setOnlineUrl(ev.online_url || "");
    setLocationName(ev.location_name || "");
    setLocationUrl(ev.location_url || "");
    setAddress(
      ev.address || {
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
        country: "Brasil",
      },
    );
    setStartsAt(ev.is_all_day ? toDateOnly(ev.starts_at) : toDatetimeLocal(ev.starts_at));
    setEndsAt(ev.is_all_day ? toDateOnly(ev.ends_at) : toDatetimeLocal(ev.ends_at));
    setCurrentBannerUrl(ev.banner_url || null);
  }, []);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/events/${id}`, { credentials: "include" });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const ev = await res.json();
        if (!ev.is_owner) {
          setForbidden(true);
          return;
        }
        populateForm(ev);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, populateForm]);

  async function handleBannerFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBannerLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/events/${id}/banner`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentBannerUrl(data.banner_url);
      }
    } finally {
      setBannerLoading(false);
    }
  }

  async function handleSetBannerUrl() {
    const url = bannerUrlInput.trim();
    if (!url) return;
    setBannerLoading(true);
    try {
      const res = await fetch(`/api/v1/events/${id}/banner`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_url: url }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentBannerUrl(data.banner_url);
        setBannerUrlInput("");
      }
    } finally {
      setBannerLoading(false);
    }
  }

  async function handleRemoveBanner() {
    setBannerLoading(true);
    try {
      await fetch(`/api/v1/events/${id}/banner`, { method: "DELETE", credentials: "include" });
      setCurrentBannerUrl(null);
    } finally {
      setBannerLoading(false);
    }
  }

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
      address: !isOnline && address.city ? address : null,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/events/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Erro ao salvar as alterações.");
        return;
      }
      router.push(`/agenda/${id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size="large" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.center}>
        <p>Evento não encontrado.</p>
        <Link href="/agenda">← Voltar para a agenda</Link>
      </div>
    );
  }

  if (forbidden || !user) {
    return (
      <div className={styles.center}>
        <p>Você não tem permissão para editar este evento.</p>
        <Link href={`/agenda/${id}`}>← Ver evento</Link>
      </div>
    );
  }

  return (
    <>
      <SeoHead title="Editar Evento — Agenda Indies Brasil" description="Edite as informações do evento." />

      <div className={styles.pageWrapper}>
        <Link href={`/agenda/${id}`} className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Voltar ao evento
        </Link>

        <h1 className={styles.pageTitle}>Editar Evento</h1>

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
              maxLength={2000}
            />
          </div>

          {/* Imagem de Capa */}
          <div className={styles.field}>
            <label className={styles.label}>Imagem de Capa</label>

            <input ref={bannerFileInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleBannerFileChange} />

            {currentBannerUrl && (
              <div className={styles.bannerPreviewWrap}>
                <Image src={currentBannerUrl} alt="Capa do evento" fill className={styles.bannerImg} sizes="700px" />
                <button type="button" className={styles.removeBannerBtn} onClick={handleRemoveBanner} disabled={bannerLoading}>
                  {bannerLoading ? "..." : "Remover"}
                </button>
              </div>
            )}

            <div className={styles.bannerControls}>
              <button type="button" className={styles.bannerBtn} onClick={() => bannerFileInputRef.current?.click()} disabled={bannerLoading}>
                {currentBannerUrl ? "Alterar arquivo" : "Upload de arquivo"}
              </button>
              <div className={styles.bannerInputGroup}>
                <input
                  type="url"
                  className={styles.input}
                  value={bannerUrlInput}
                  onChange={(e) => setBannerUrlInput(e.target.value)}
                  placeholder="ou cole um link de imagem..."
                  disabled={bannerLoading}
                />
                <button type="button" className={styles.bannerBtn} onClick={handleSetBannerUrl} disabled={!bannerUrlInput.trim() || bannerLoading}>
                  Usar link
                </button>
              </div>
            </div>

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

          <label className={styles.checkboxField}>
            <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
            <span className={styles.checkboxLabel}>Evento de dia inteiro</span>
          </label>

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
            </div>
          )}

          {!isOnline && (
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
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
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

              <p className={styles.sectionTitle} style={{ marginTop: 8 }}>
                Endereço
              </p>
              <AddressFormFields value={address} onChange={(f, v) => setAddress((p) => ({ ...p, [f]: v }))} disabled={submitting} />
            </>
          )}

          <div className={styles.actions}>
            <Link href={`/agenda/${id}`} className={styles.cancelBtn}>
              Cancelar
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? <Spinner size="small" /> : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
