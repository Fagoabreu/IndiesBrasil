import { useEffect, useMemo, useState } from "react";
import { LinkIcon, PeopleIcon, VideoIcon } from "@primer/octicons-react";
import { formatMeetingRange, getMeetingPhase, getMeetingPhaseLabel } from "@/lib/meetingFormat";
import styles from "./MeetingCard.module.css";

const PHASE_CLASS = {
  scheduled: styles.phaseScheduled,
  live: styles.phaseLive,
  ended: styles.phaseEnded,
  cancelled: styles.phaseCancelled,
};

export default function MeetingCard({ meeting, viewer, authUser, slug, onChanged }) {
  const [joining, setJoining] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeReveal, setCodeReveal] = useState(null); // { guest_code, guest_code_expires_at }
  const [actionError, setActionError] = useState("");
  // "Agora" atualizado a cada 30s — mantém o render puro (sem Date.now() direto).
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = useMemo(() => getMeetingPhase(meeting, nowMs), [meeting, nowMs]);
  const phaseLabel = getMeetingPhaseLabel(meeting, nowMs);

  const canManage = Boolean(authUser) && (meeting.created_by === authUser.id || viewer?.isOwner || viewer?.isAdmin);

  const isMember = viewer?.isMember || viewer?.isOwner || viewer?.isAdmin;
  const canJoin = isMember && phase === "live";

  const codeActive = Boolean(meeting.guest_code_expires_at) && new Date(meeting.guest_code_expires_at).getTime() > nowMs;

  const guestLink = useMemo(() => {
    if (typeof window === "undefined") return `/reunioes/${meeting.id}`;
    return `${window.location.origin}/reunioes/${meeting.id}`;
  }, [meeting.id]);

  async function apiCall(url, options = {}) {
    const res = await fetch(url, { credentials: "include", ...options });
    if (res.status === 204) return { ok: true, data: null };
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function handleJoin() {
    setActionError("");
    setJoining(true);
    try {
      const { ok, data } = await apiCall(`/api/v1/studios/${slug}/meetings/${meeting.id}/join`, {
        method: "POST",
      });
      if (!ok) {
        setActionError(data.message || "Não foi possível entrar na reunião.");
        return;
      }
      window.location.href = data.joinUrl;
    } catch {
      setActionError("Erro de conexão. Tente novamente.");
    } finally {
      setJoining(false);
    }
  }

  async function handleGenerateCode() {
    setActionError("");
    setCodeBusy(true);
    try {
      const { ok, data } = await apiCall(`/api/v1/studios/${slug}/meetings/${meeting.id}/guest-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!ok) {
        setActionError(data.message || "Erro ao gerar código de convidado.");
        return;
      }
      setCodeReveal(data);
      if (onChanged) onChanged();
    } catch {
      setActionError("Erro de conexão. Tente novamente.");
    } finally {
      setCodeBusy(false);
    }
  }

  async function handleRevokeCode() {
    setActionError("");
    setCodeBusy(true);
    try {
      const { ok, data } = await apiCall(`/api/v1/studios/${slug}/meetings/${meeting.id}/guest-code`, { method: "DELETE" });
      if (!ok) {
        setActionError(data.message || "Erro ao revogar o código.");
        return;
      }
      setCodeReveal(null);
      if (onChanged) onChanged();
    } catch {
      setActionError("Erro de conexão. Tente novamente.");
    } finally {
      setCodeBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancelar esta reunião? Esta ação não pode ser desfeita.")) return;
    setActionError("");
    const { ok, data } = await apiCall(`/api/v1/studios/${slug}/meetings/${meeting.id}`, {
      method: "DELETE",
    });
    if (!ok) {
      setActionError(data.message || "Erro ao cancelar reunião.");
      return;
    }
    if (onChanged) onChanged();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <h3 className={styles.title}>{meeting.title}</h3>
        <span className={`${styles.phase} ${PHASE_CLASS[phase] || ""}`}>{phaseLabel}</span>
      </div>

      <p className={styles.meta}>
        <span className={styles.metaDate}>{formatMeetingRange(meeting.starts_at, meeting.ends_at)}</span>
        {meeting.created_by_username && <span className={styles.metaCreator}>por {meeting.created_by_username}</span>}
        {meeting.max_participants && (
          <span className={styles.metaLimit}>
            <PeopleIcon size={12} /> máx. {meeting.max_participants}
          </span>
        )}
      </p>

      {meeting.description && <p className={styles.description}>{meeting.description}</p>}

      {actionError && <div className={styles.error}>{actionError}</div>}

      {canJoin && (
        <div className={styles.actions}>
          <button className={styles.joinBtn} onClick={handleJoin} disabled={joining}>
            <VideoIcon size={14} /> {joining ? "Entrando…" : "Entrar na reunião"}
          </button>
        </div>
      )}

      {phase === "scheduled" && <p className={styles.hint}>Disponível no horário agendado. Os participantes entram pela sala quando ela abrir.</p>}

      {canManage && (phase === "scheduled" || phase === "live") && (
        <div className={styles.managerBox}>
          <p className={styles.managerTitle}>Código de convidado (acesso externo)</p>

          {codeActive && !codeReveal && (
            <p className={styles.codeActiveNote}>Código ativo até {new Date(meeting.guest_code_expires_at).toLocaleString("pt-BR")}.</p>
          )}

          {codeReveal && (
            <div className={styles.codeBox}>
              <p className={styles.codeLabel}>Código gerado (mostrado uma única vez):</p>
              <p className={styles.codeValue}>{codeReveal.guest_code}</p>
              <p className={styles.codeExpiry}>
                Válido até{" "}
                {codeReveal.guest_code_expires_at ? new Date(codeReveal.guest_code_expires_at).toLocaleString("pt-BR") : "o término da reunião"}.
              </p>
              <button type="button" className={styles.copyBtn} onClick={() => copyText(`${guestLink}\nCódigo: ${codeReveal.guest_code}`)}>
                Copiar link + código
              </button>
            </div>
          )}

          <div className={styles.managerActions}>
            <button type="button" className={styles.secondaryBtn} onClick={handleGenerateCode} disabled={codeBusy}>
              {codeActive || codeReveal ? "Regenerar código" : "Gerar código de convidado"}
            </button>
            {(codeActive || codeReveal) && (
              <button type="button" className={styles.dangerBtn} onClick={handleRevokeCode} disabled={codeBusy}>
                Revogar código
              </button>
            )}
          </div>

          <p className={styles.linkRow}>
            <LinkIcon size={12} /> Convide externos:{" "}
            <button type="button" className={styles.linkCopy} onClick={() => copyText(guestLink)}>
              {guestLink}
            </button>
          </p>

          {phase !== "live" && (
            <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
              Cancelar reunião
            </button>
          )}
        </div>
      )}
    </article>
  );
}
