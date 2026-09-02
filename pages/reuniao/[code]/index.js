import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Spinner } from "@primer/react";
import {
  AlertIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  InfoIcon,
  OrganizationIcon,
  PeopleIcon,
  PlayIcon,
  VideoIcon,
} from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import SeoHead from "@/components/SeoHead";
import ReportModal from "@/components/ReportModal/ReportModal";

// A sala usa livekit-client (WebRTC) — carrega apenas no navegador.
const MeetingRoom = dynamic(() => import("@/components/Meeting/MeetingRoom"), { ssr: false });

import styles from "./index.module.css";

const GUEST_NAME_KEY = "indiesbrasil_guest_name";

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function StatusBadge({ status }) {
  const labelMap = {
    scheduled: "Agendada",
    active: "Ao vivo",
    ended: "Encerrada",
    cancelled: "Cancelada",
  };
  const classMap = {
    scheduled: styles.badgeScheduled,
    active: styles.badgeActive,
    ended: styles.badgeEnded,
    cancelled: styles.badgeCancelled,
  };
  return (
    <span className={`${styles.badge} ${classMap[status] ?? ""}`}>
      {status === "active" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
      {labelMap[status] ?? status}
    </span>
  );
}

export default function ReuniaoPage() {
  const router = useRouter();
  const { code } = router.query;
  const inviteToken = typeof router.query.convite === "string" ? router.query.convite : null;
  const { user: authUser, loadingUser } = useUser();

  const [meeting, setMeeting] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [notice, setNotice] = useState(null);
  const [joinInfo, setJoinInfo] = useState(null); // { token, server_url, room, identity, mode }
  const [leftReason, setLeftReason] = useState(null); // 'leave' | 'disconnect'
  const [now, setNow] = useState(null);

  // Denúncia de reunião
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [reportSent, setReportSent] = useState(false);

  // Lê o nome do convidado salvo após o primeiro paint (evita hydration mismatch).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(GUEST_NAME_KEY);
        if (stored) setGuestName(stored);
      } catch {
        // localStorage indisponível — ignora.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Recarrega os dados em silêncio (ex.: após iniciar/terminar ou sair da sala).
  async function refreshMeeting() {
    if (!code) return;
    try {
      const response = await fetch(`/api/v1/meetings/${code}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setLoadError({ message: data?.message || "Reunião não encontrada.", action: data?.action });
        setMeeting(null);
      } else {
        setLoadError(null);
        setMeeting(data);
        setNow(Date.now());
      }
    } catch {
      setLoadError({ message: "Falha ao carregar a reunião. Tente novamente." });
      setMeeting(null);
    }
  }

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    fetch(`/api/v1/meetings/${code}`, { credentials: "include" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || data?.status_code) {
          setLoadError({ message: data?.message || "Reunião não encontrada.", action: data?.action });
          setMeeting(null);
        } else {
          setLoadError(null);
          setMeeting(data);
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError({ message: "Falha ao carregar a reunião. Tente novamente." });
        setMeeting(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  function handleExit(reason) {
    setJoinInfo(null);
    setNotice(reason === "disconnect" ? "A sala foi encerrada ou a conexão caiu." : "Você saiu da reunião.");
    setLeftReason(reason);
    setJoining(false);
    refreshMeeting();
  }

  async function handleJoin() {
    if (!meeting || joining) return;
    setJoinError(null);
    setJoining(true);
    try {
      const viewer = meeting.viewer || {};
      const isMember = viewer.is_authenticated && viewer.is_member;
      const body = isMember ? {} : { invite_token: inviteToken || "", name: guestName };
      const response = await fetch(`/api/v1/meetings/${meeting.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setJoinError(data?.message || "Não foi possível entrar na reunião.");
        if (!isMember && guestName) {
          try {
            window.localStorage.setItem(GUEST_NAME_KEY, guestName);
          } catch {
            // ignora
          }
        }
        return;
      }
      if (!isMember && guestName) {
        try {
          window.localStorage.setItem(GUEST_NAME_KEY, guestName);
        } catch {
          // ignora
        }
      }
      setJoinInfo(data);
      setNotice(null);
      setLeftReason(null);
    } catch {
      setJoinError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setJoining(false);
    }
  }

  async function handleStartNow() {
    if (!meeting || starting) return;
    setStarting(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/v1/studios/${meeting.org.slug}/meetings/${meeting.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "start" }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setJoinError(data?.message || "Não foi possível iniciar a reunião.");
        return;
      }
      await refreshMeeting();
    } catch {
      setJoinError("Falha de conexão. Tente novamente.");
    } finally {
      setStarting(false);
    }
  }

  async function handleEndForAll() {
    if (!meeting) return;
    const response = await fetch(`/api/v1/studios/${meeting.org.slug}/meetings/${meeting.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "end" }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.status_code) {
      console.error("[ReuniaoPage] falha ao encerrar:", data?.message);
    }
  }

  async function handleReportMeeting(reason, justification) {
    if (!meeting || reportSubmitting) return;
    setReportSubmitting(true);
    setReportError(null);
    try {
      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_type: "meeting",
          target_id: String(meeting.id),
          reason,
          justification: justification || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setReportError(data?.message || "Não foi possível enviar a denúncia.");
        return;
      }
      setReportOpen(false);
      setReportSent(true);
    } catch {
      setReportError("Não foi possível enviar a denúncia.");
    } finally {
      setReportSubmitting(false);
    }
  }

  // ===== Estados terminais =====
  if (loading || (loadingUser && !meeting)) {
    return (
      <>
        <SeoHead title="Reunião" description="Entrando na reunião…" />
        <div className={styles.connecting}>
          <Spinner size="large" />
          <p>Carregando reunião…</p>
        </div>
      </>
    );
  }

  if (loadError || !meeting) {
    return (
      <>
        <SeoHead title="Reunião não encontrada" description="Reunião não encontrada." />
        <div className={styles.page}>
          <div className={styles.card}>
            <div className={styles.cardAccent} />
            <div className={styles.cardBody}>
              <div className={`${styles.statusBlock} ${styles.statusDanger}`}>
                <AlertIcon size={18} className={styles.statusIcon} />
                <div>
                  <p className={styles.statusTitle}>{loadError?.message || "Reunião não encontrada."}</p>
                  {loadError?.action && <p className={styles.statusText}>{loadError.action}</p>}
                </div>
              </div>
              <Link href="/" className={styles.btnOutline}>
                <ArrowLeftIcon size={14} /> Voltar ao início
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const viewer = meeting.viewer || {};
  const canManage = Boolean(viewer.is_host || viewer.is_admin || viewer.is_owner);
  const scheduledNotStarted = meeting.status === "scheduled" && now !== null && new Date(meeting.starts_at).getTime() > now;

  // ===== Sala ao vivo =====
  if (joinInfo?.token) {
    return (
      <>
        <SeoHead title={`${meeting.title} — Reunião`} description={meeting.description || `Reunião de ${meeting.org.name}`} />
        <MeetingRoom
          token={joinInfo.token}
          serverUrl={joinInfo.server_url}
          displayName={joinInfo.mode === "member" ? authUser?.username || meeting.created_by_username : guestName}
          meetingTitle={meeting.title}
          orgName={meeting.org.name}
          isManager={canManage}
          onEndForAll={canManage ? handleEndForAll : null}
          onExit={handleExit}
        />
      </>
    );
  }

  const isMember = Boolean(viewer.is_authenticated && viewer.is_member);
  const isGuest = !isMember;
  const showGuestForm = isGuest;

  const canEnter = meeting.status === "active" || (meeting.status === "scheduled" && !scheduledNotStarted);

  return (
    <>
      <SeoHead
        title={`${meeting.title} — ${meeting.org.name}`}
        description={meeting.description || `Reunião de ${meeting.org.name}. Acesso restrito a membros e convidados com link.`}
      />
      <div className={styles.page}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> IndiesBrasil
        </Link>

        <div className={styles.card}>
          <div className={styles.cardAccent} />
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <h1 className={styles.title}>{meeting.title}</h1>
              <StatusBadge status={meeting.status} />
            </div>

            <div className={styles.meta}>
              {meeting.org && (
                <Link href={`/estudios/${meeting.org.slug}`} className={styles.orgRow} style={{ textDecoration: "none", color: "inherit" }}>
                  {meeting.org.logo_url ? (
                    <span className={styles.orgLogo}>
                      <Image src={meeting.org.logo_url} alt={`Logo de ${meeting.org.name}`} width={22} height={22} style={{ display: "block" }} />
                    </span>
                  ) : (
                    <OrganizationIcon size={18} />
                  )}
                  <span style={{ fontWeight: 600 }}>{meeting.org.name}</span>
                </Link>
              )}
              <span className={styles.metaRow}>
                <CalendarIcon size={14} />
                {meeting.status === "scheduled"
                  ? formatDateTime(meeting.starts_at)
                  : meeting.status === "active"
                    ? "Em andamento agora"
                    : "Já encerrada"}
              </span>
              {meeting.ends_at && meeting.status === "scheduled" && (
                <span className={styles.metaRow}>
                  <ClockIcon size={14} /> até {formatTime(meeting.ends_at)}
                </span>
              )}
              {meeting.created_by_username && (
                <span className={styles.metaRow}>
                  <PeopleIcon size={14} /> Organizada por {meeting.created_by_username}
                </span>
              )}
            </div>

            {meeting.description && <p className={styles.description}>{meeting.description}</p>}

            <hr className={styles.divider} />

            {/* Status terminal */}
            {meeting.status === "cancelled" && (
              <div className={`${styles.statusBlock} ${styles.statusDanger}`}>
                <AlertIcon size={18} className={styles.statusIcon} />
                <div>
                  <p className={styles.statusTitle}>Esta reunião foi cancelada.</p>
                  <p className={styles.statusText}>Entre em contato com o organizador para saber os próximos passos.</p>
                </div>
              </div>
            )}
            {meeting.status === "ended" && (
              <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
                <InfoIcon size={18} className={styles.statusIcon} />
                <div>
                  <p className={styles.statusTitle}>Esta reunião já foi encerrada.</p>
                  <p className={styles.statusText}>Obrigado por participar!</p>
                </div>
              </div>
            )}

            {meeting.is_blocked && meeting.status !== "ended" && meeting.status !== "cancelled" && (
              <div className={`${styles.statusBlock} ${styles.statusDanger}`}>
                <AlertIcon size={18} className={styles.statusIcon} />
                <div>
                  <p className={styles.statusTitle}>Esta reunião está indisponível.</p>
                  <p className={styles.statusText}>Ela foi bloqueada pela moderação da plataforma.</p>
                </div>
              </div>
            )}

            {/* Reunião ao vivo / agendada: bloco de entrada */}
            {!meeting.is_blocked && (meeting.status === "active" || meeting.status === "scheduled") && (
              <div className={styles.joinBox}>
                {leftReason && (
                  <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
                    <InfoIcon size={18} className={styles.statusIcon} />
                    <p className={styles.statusText}>{notice}</p>
                  </div>
                )}
                {joinError && (
                  <div className={`${styles.statusBlock} ${styles.statusWarn}`}>
                    <AlertIcon size={18} className={styles.statusIcon} />
                    <div>
                      <p className={styles.statusTitle}>Não foi possível entrar</p>
                      <p className={styles.statusText}>{joinError}</p>
                    </div>
                  </div>
                )}

                {reportSent && (
                  <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
                    <InfoIcon size={18} className={styles.statusIcon} />
                    <p className={styles.statusText}>Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.</p>
                  </div>
                )}

                {scheduledNotStarted && !canManage && (
                  <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
                    <ClockIcon size={18} className={styles.statusIcon} />
                    <div>
                      <p className={styles.statusTitle}>A reunião ainda não começou.</p>
                      <p className={styles.statusText}>Ela será aberta em {formatDateTime(meeting.starts_at)}. Volte aqui na hora marcada.</p>
                    </div>
                  </div>
                )}

                {showGuestForm && !scheduledNotStarted && (
                  <div>
                    <label className={styles.fieldLabel} htmlFor="guest-name">
                      Seu nome
                    </label>
                    <input
                      id="guest-name"
                      className={styles.input}
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Como você quer aparecer na reunião?"
                      maxLength={60}
                      autoComplete="name"
                    />
                    <p className={styles.hint}>
                      {inviteToken
                        ? "Você está entrando como convidado(a) pelo link do organizador."
                        : "Você está entrando como convidado(a). Apenas pessoas com o link de convite do organizador podem participar."}
                    </p>
                  </div>
                )}

                <div className={styles.actionsRow}>
                  {canManage && scheduledNotStarted && (
                    <button type="button" className={styles.btnPrimary} onClick={handleStartNow} disabled={starting}>
                      {starting ? <Spinner size="small" /> : <PlayIcon size={16} />}
                      Iniciar agora
                    </button>
                  )}
                  {scheduledNotStarted && !canManage && (
                    <button type="button" className={styles.btnPrimary} disabled>
                      <ClockIcon size={16} /> Aguardando início
                    </button>
                  )}
                  {canEnter && (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleJoin}
                      disabled={joining || (showGuestForm && !guestName.trim()) || meeting.status === "ended" || meeting.status === "cancelled"}
                    >
                      {joining ? <Spinner size="small" /> : <VideoIcon size={16} />}
                      {joining ? "Entrando…" : isMember ? "Entrar na reunião" : "Participar como convidado"}
                    </button>
                  )}
                  <Link href={`/estudios/${meeting.org.slug}`} className={styles.btnOutline}>
                    Ver estúdio
                  </Link>
                </div>

                {canManage && !scheduledNotStarted && meeting.status === "scheduled" && (
                  <p className={styles.hint}>A reunião já pode ser iniciada. Toque em “Entrar na reunião” para abrir a sala.</p>
                )}
                {canManage && meeting.status === "active" && (
                  <p className={styles.hint}>Você é o organizador(a). Use “Encerrar para todos” dentro da sala quando terminar.</p>
                )}

                {Boolean(viewer.is_authenticated) && !canManage && (
                  <div className={styles.actionsRow}>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => {
                        setReportSent(false);
                        setReportError(null);
                        setReportOpen(true);
                      }}
                    >
                      <AlertIcon size={14} /> Denunciar reunião
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          title="Denunciar reunião"
          onClose={() => setReportOpen(false)}
          onSubmit={handleReportMeeting}
          submitting={reportSubmitting}
          error={reportError}
        />
      )}
    </>
  );
}
