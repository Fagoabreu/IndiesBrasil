import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { AlertIcon, ArrowLeftIcon, CalendarIcon, ClockIcon, InfoIcon, PeopleIcon, PlusIcon, VideoIcon, XIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";

import styles from "./reunioes.module.css";

const STATUS_LABELS = {
  scheduled: "Agendada",
  active: "Ao vivo",
  ended: "Encerrada",
  cancelled: "Cancelada",
};

const DURATION_OPTIONS = [
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "45 minutos", value: 45 },
  { label: "1 hora", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2 horas", value: 120 },
];

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatFull(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function StatusBadge({ status }) {
  const classMap = {
    scheduled: styles.badgeScheduled,
    active: styles.badgeActive,
    ended: styles.badgeEnded,
    cancelled: styles.badgeCancelled,
  };
  return <span className={`${styles.badge} ${classMap[status] ?? ""}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function MeetingCard({ slug, meeting, now }) {
  const joinable = meeting.status === "active" || (meeting.status === "scheduled" && now !== null && new Date(meeting.starts_at).getTime() <= now);
  return (
    <div className={styles.meetingCard}>
      <div className={styles.meetingMain}>
        <div className={styles.meetingTitleRow}>
          <p className={styles.meetingTitle}>{meeting.title}</p>
          <StatusBadge status={meeting.status} />
        </div>
        {meeting.description && <p className={styles.meetingDesc}>{meeting.description}</p>}
        <div className={styles.meetingMeta}>
          {meeting.status === "scheduled" ? (
            <>
              <CalendarIcon size={12} /> {formatFull(meeting.starts_at)}
              {meeting.ends_at && (
                <>
                  <ClockIcon size={12} /> até{" "}
                  {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(meeting.ends_at))}
                </>
              )}
            </>
          ) : (
            <ClockIcon size={12} />
          )}
          {meeting.status === "scheduled" && "marcada"}
          {meeting.status === "active" && "em andamento agora"}
          {meeting.status === "ended" && meeting.ended_at ? `encerrada em ${formatDateBR(meeting.ended_at)}` : "encerrada"}
          {meeting.status === "cancelled" && "cancelada"}
          {meeting.created_by_username && (
            <>
              <PeopleIcon size={12} /> por {meeting.created_by_username}
            </>
          )}
        </div>
      </div>
      <div className={styles.cardActions}>
        {joinable && (
          <Link href={`/reuniao/${meeting.code}`} className={styles.btnPrimary}>
            <VideoIcon size={14} /> Entrar
          </Link>
        )}
        <Link href={`/estudios/${slug}/reunioes/${meeting.code}`} className={styles.btnOutline}>
          Detalhes
        </Link>
      </div>
    </div>
  );
}

export default function StudioMeetingsPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [studio, setStudio] = useState(null);
  const [meetings, setMeetings] = useState(null);
  const [error, setError] = useState(null);
  const [loadingStudio, setLoadingStudio] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    mode: "now", // "now" | "scheduled"
    startsAt: "",
    duration: 60,
  });
  const [now, setNow] = useState(null);

  // Recarrega a lista após criar uma reunião agendada.
  async function refreshMeetings() {
    if (!slug) return;
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setError({ message: data?.message || "Não foi possível carregar as reuniões.", action: data?.action });
        setMeetings([]);
      } else {
        setMeetings(data);
        setError(null);
        setNow(Date.now());
      }
    } catch {
      setError({ message: "Falha de conexão ao carregar as reuniões." });
      setMeetings([]);
    }
  }

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;

    fetch(`/api/v1/studios/${slug}`, { credentials: "include" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        setStudio(ok && !data?.status_code ? data : null);
      })
      .catch(() => {
        if (!cancelled) setStudio(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingStudio(false);
      });

    fetch(`/api/v1/studios/${slug}/meetings`, { credentials: "include" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || data?.status_code) {
          setError({ message: data?.message || "Não foi possível carregar as reuniões.", action: data?.action });
          setMeetings([]);
        } else {
          setMeetings(data);
          setError(null);
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError({ message: "Falha de conexão ao carregar as reuniões." });
        setMeetings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const viewer = studio?.viewer || {};
  const isMember = Boolean(viewer.is_owner || viewer.is_admin || viewer.is_member);

  const groups = useMemo(() => {
    const list = meetings || [];
    const live = list.filter((m) => m.status === "active");
    const upcoming = list.filter((m) => m.status === "scheduled").sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const past = list.filter((m) => m.status === "ended" || m.status === "cancelled");
    return { live, upcoming, past };
  }, [meetings]);

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function openCreate() {
    setCreateError(null);
    setCreateSuccess(null);
    setForm({ title: "", description: "", mode: "now", startsAt: "", duration: 60 });
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (creating) return;
    setCreateError(null);
    setCreateSuccess(null);

    const title = form.title.trim();
    if (!title) {
      setCreateError("Informe um título para a reunião.");
      return;
    }

    let startsAt = null;
    if (form.mode === "scheduled") {
      if (!form.startsAt) {
        setCreateError("Informe a data e o horário da reunião.");
        return;
      }
      const parsed = new Date(form.startsAt);
      if (Number.isNaN(parsed.getTime())) {
        setCreateError("Data/horário inválidos.");
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        setCreateError("O horário da reunião precisa ser no futuro.");
        return;
      }
      startsAt = parsed.toISOString();
    }

    const endsAt = startsAt ? new Date(new Date(startsAt).getTime() + form.duration * 60 * 1000).toISOString() : null;

    setCreating(true);
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description: form.description.trim() || null, starts_at: startsAt, ends_at: endsAt }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setCreateError(data?.message || "Não foi possível criar a reunião.");
        return;
      }
      if (form.mode === "scheduled") {
        setCreateOpen(false);
        setCreateSuccess(`Reunião “${data.title}” agendada! Os membros do estúdio foram avisados.`);
        refreshMeetings();
      } else {
        // Reunião imediata: já abre a sala.
        router.push(`/reuniao/${data.code}`);
      }
    } catch {
      setCreateError("Falha de conexão. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  if (loadingStudio) {
    return (
      <>
        <SeoHead title="Reuniões" description="Reuniões do estúdio." />
        <div className={styles.connecting}>
          <Spinner size="large" />
          <p>Carregando…</p>
        </div>
      </>
    );
  }

  if (!studio) {
    return (
      <>
        <SeoHead title="Estúdio não encontrado" description="Estúdio não encontrado." />
        <div className={styles.page}>
          <div className={`${styles.statusBlock} ${styles.statusDanger}`}>
            <AlertIcon size={18} />
            <p className={styles.statusText}>Estúdio não encontrado.</p>
          </div>
          <Link href="/estudios" className={styles.btnOutline}>
            <ArrowLeftIcon size={14} /> Ver estúdios
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title={`Reuniões — ${studio.name}`} description={`Reuniões de ${studio.name} no IndiesBrasil.`} />
      <div className={styles.page}>
        <div className={styles.head}>
          <div className={styles.titleGroup}>
            <Link href={`/estudios/${slug}`} className={styles.backLink}>
              <ArrowLeftIcon size={14} /> {studio.name}
            </Link>
            <h1 className={styles.title}>Reuniões do estúdio</h1>
            <p className={styles.subtitle}>Encontros por vídeo com os membros do time — privados e por convite.</p>
          </div>
          {isMember && (
            <button type="button" className={styles.btnPrimary} onClick={openCreate}>
              <PlusIcon size={14} /> Nova reunião
            </button>
          )}
        </div>

        {error && (
          <div className={`${styles.statusBlock} ${styles.statusWarn}`}>
            <AlertIcon size={18} />
            <div>
              <p className={styles.statusTitle}>{error.message}</p>
              {error.action && <p className={styles.statusText}>{error.action}</p>}
            </div>
          </div>
        )}

        {createSuccess && (
          <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
            <InfoIcon size={18} />
            <p className={styles.statusText}>{createSuccess}</p>
          </div>
        )}

        {!error && meetings !== null && meetings.length === 0 && (
          <div className={styles.emptyState}>
            <VideoIcon size={28} />
            <p>Nenhuma reunião ainda.</p>
            {isMember ? (
              <button type="button" className={styles.btnPrimary} onClick={openCreate}>
                <PlusIcon size={14} /> Criar a primeira reunião
              </button>
            ) : (
              <p>Só membros do estúdio podem criar reuniões.</p>
            )}
          </div>
        )}

        {!error && meetings !== null && meetings.length > 0 && (
          <>
            {groups.live.length > 0 && (
              <section>
                <h2 className={styles.sectionTitle}>Em andamento</h2>
                <div className={styles.meetingList}>
                  {groups.live.map((meeting) => (
                    <MeetingCard key={meeting.code} slug={slug} meeting={meeting} now={now} />
                  ))}
                </div>
              </section>
            )}
            {groups.upcoming.length > 0 && (
              <section>
                <h2 className={styles.sectionTitle}>Agendadas</h2>
                <div className={styles.meetingList}>
                  {groups.upcoming.map((meeting) => (
                    <MeetingCard key={meeting.code} slug={slug} meeting={meeting} now={now} />
                  ))}
                </div>
              </section>
            )}
            {groups.past.length > 0 && (
              <section>
                <h2 className={styles.sectionTitle}>Encerradas</h2>
                <div className={styles.meetingList}>
                  {groups.past.map((meeting) => (
                    <MeetingCard key={meeting.code} slug={slug} meeting={meeting} now={now} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {createOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Nova reunião" onClick={() => setCreateOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <form onSubmit={handleCreate}>
              <div className={styles.modalHead}>
                <h3>Nova reunião</h3>
                <button type="button" className={styles.iconBtn} onClick={() => setCreateOpen(false)} aria-label="Fechar">
                  <XIcon size={14} />
                </button>
              </div>
              <div className={styles.modalBody}>
                {createError && (
                  <div className={`${styles.statusBlock} ${styles.statusDanger}`}>
                    <AlertIcon size={18} />
                    <p className={styles.statusText}>{createError}</p>
                  </div>
                )}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="meeting-title">
                    Título
                  </label>
                  <input
                    id="meeting-title"
                    className={styles.input}
                    value={form.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder="Ex.: Review da demo de outubro"
                    maxLength={120}
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="meeting-desc">
                    Descrição (opcional)
                  </label>
                  <textarea
                    id="meeting-desc"
                    className={styles.textarea}
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    placeholder="Pauta, links úteis, o que preparar…"
                    maxLength={2000}
                  />
                </div>

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={form.mode === "scheduled"}
                    onChange={(event) => updateField("mode", event.target.checked ? "scheduled" : "now")}
                  />
                  Agendar para uma data futura
                </label>

                {form.mode === "scheduled" && (
                  <>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="meeting-start">
                        Data e horário
                      </label>
                      <input
                        id="meeting-start"
                        className={styles.input}
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(event) => updateField("startsAt", event.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="meeting-duration">
                        Duração prevista
                      </label>
                      <select
                        id="meeting-duration"
                        className={styles.select}
                        value={form.duration}
                        onChange={(event) => updateField("duration", Number.parseInt(event.target.value, 10))}
                      >
                        {DURATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {form.mode === "now" && (
                  <p className={styles.hint}>A reunião será criada já disponível. Mande o link de convite para quem quiser entrar.</p>
                )}
              </div>
              <div className={styles.modalFoot}>
                <button type="button" className={styles.btnOutline} onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={creating}>
                  {creating ? <Spinner size="small" /> : <VideoIcon size={14} />}
                  {form.mode === "scheduled" ? "Agendar reunião" : "Iniciar reunião"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
