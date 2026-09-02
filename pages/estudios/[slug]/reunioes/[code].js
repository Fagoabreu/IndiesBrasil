import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import {
  AlertIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  InfoIcon,
  LinkIcon,
  PencilIcon,
  PeopleIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  VideoIcon,
  XIcon,
} from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import ReportModal from "@/components/ReportModal/ReportModal";

import styles from "./reunioes.module.css";

const STATUS_LABELS = {
  scheduled: "Agendada",
  active: "Ao vivo",
  ended: "Encerrada",
  cancelled: "Cancelada",
};

const TTL_OPTIONS = [
  { label: "1 hora", value: 1 },
  { label: "24 horas (1 dia)", value: 24 },
  { label: "3 dias", value: 72 },
  { label: "7 dias", value: 168 },
];

function formatFull(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
}

export default function StudioMeetingDetailPage() {
  const router = useRouter();
  const { slug, code } = router.query;

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // action name
  const [flash, setFlash] = useState(null); // { type: 'ok' | 'err', text }

  // Edição de metadados
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Convites
  const [inviteTtl, setInviteTtl] = useState(24);
  const [createdLink, setCreatedLink] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [now, setNow] = useState(null);

  // Denúncia de reunião
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Recarrega os dados em silêncio após ações (start/end/save/invite/revoke).
  async function refreshMeeting() {
    if (!slug || !code) return;
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings/${code}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setError({ message: data?.message || "Reunião não encontrada.", action: data?.action });
        setMeeting(null);
      } else {
        setMeeting(data);
        setError(null);
        setEditTitle(data.title || "");
        setEditDesc(data.description || "");
      }
    } catch {
      setError({ message: "Falha de conexão." });
      setMeeting(null);
    }
  }

  useEffect(() => {
    if (!slug || !code) return undefined;
    let cancelled = false;
    fetch(`/api/v1/studios/${slug}/meetings/${code}`, { credentials: "include" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || data?.status_code) {
          setError({ message: data?.message || "Reunião não encontrada.", action: data?.action });
          setMeeting(null);
        } else {
          setMeeting(data);
          setEditTitle(data.title || "");
          setEditDesc(data.description || "");
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError({ message: "Falha de conexão." });
        setMeeting(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, code]);

  async function runAction(action, payload = {}) {
    if (busy) return;
    setBusy(action);
    setFlash(null);
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setFlash({ type: "err", text: data?.message || "Não foi possível concluir a ação." });
        return false;
      }
      return true;
    } catch {
      setFlash({ type: "err", text: "Falha de conexão. Tente novamente." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleStart() {
    const ok = await runAction("start");
    if (ok) {
      setFlash({ type: "ok", text: "Reunião iniciada! Os participantes já podem entrar." });
      refreshMeeting();
    }
  }

  async function handleEnd() {
    const confirmed = window.confirm("Encerrar esta reunião para todos os participantes?");
    if (!confirmed) return;
    const ok = await runAction("end");
    if (ok) {
      setFlash({ type: "ok", text: "Reunião encerrada." });
      refreshMeeting();
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm("Cancelar esta reunião? Os participantes não poderão mais entrar.");
    if (!confirmed) return;
    const ok = await runAction("cancel");
    if (ok) {
      setFlash({ type: "ok", text: "Reunião cancelada." });
      refreshMeeting();
    }
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    const title = editTitle.trim();
    if (!title) {
      setFlash({ type: "err", text: "O título é obrigatório." });
      return;
    }
    setBusy("save");
    setFlash(null);
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description: editDesc.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setFlash({ type: "err", text: data?.message || "Não foi possível salvar as alterações." });
        return;
      }
      setEditing(false);
      setFlash({ type: "ok", text: "Alterações salvas." });
      refreshMeeting();
    } catch {
      setFlash({ type: "err", text: "Falha de conexão. Tente novamente." });
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateInvite() {
    if (busy) return;
    setBusy("invite");
    setFlash(null);
    setCreatedLink(null);
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings/${code}/guest-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ttl_hours: inviteTtl }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setFlash({ type: "err", text: data?.message || "Não foi possível criar o link de convite." });
        return;
      }
      setCreatedLink(data.join_url);
      setFlash({ type: "ok", text: "Link de convite criado! Compartilhe com quem deve participar." });
      refreshMeeting(); // atualiza a lista de chaves
    } catch {
      setFlash({ type: "err", text: "Falha de conexão. Tente novamente." });
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeKey(keyId) {
    const confirmed = window.confirm("Revogar este link de convite? Quem o tiver não poderá mais entrar com ele.");
    if (!confirmed) return;
    setBusy(`revoke-${keyId}`);
    try {
      const response = await fetch(`/api/v1/studios/${slug}/meetings/${code}/guest-keys/${keyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok || data?.status_code) {
        setFlash({ type: "err", text: data?.message || "Não foi possível revogar o link." });
      } else {
        setFlash({ type: "ok", text: "Link de convite revogado." });
        refreshMeeting();
      }
    } catch {
      setFlash({ type: "err", text: "Falha de conexão. Tente novamente." });
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy(url, keyId) {
    const ok = await copyText(url);
    if (ok) {
      setCopiedId(keyId ?? "new");
      setTimeout(() => setCopiedId(null), 1800);
    } else {
      setFlash({ type: "err", text: "Não foi possível copiar. Copie manualmente o link abaixo." });
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
      setFlash({ type: "ok", text: "Denúncia enviada. A moderação vai analisar." });
    } catch {
      setReportError("Não foi possível enviar a denúncia.");
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <SeoHead title="Reunião" description="Detalhes da reunião." />
        <div className={styles.connecting}>
          <Spinner size="large" />
          <p>Carregando reunião…</p>
        </div>
      </>
    );
  }

  if (error || !meeting) {
    return (
      <>
        <SeoHead title="Reunião não encontrada" description="Reunião não encontrada." />
        <div className={styles.page}>
          <div className={`${styles.statusBlock} ${styles.statusDanger}`}>
            <AlertIcon size={18} />
            <div>
              <p className={styles.statusTitle}>{error?.message || "Reunião não encontrada."}</p>
              {error?.action && <p className={styles.statusText}>{error.action}</p>}
            </div>
          </div>
          <Link href={`/estudios/${slug}`} className={styles.btnOutline}>
            <ArrowLeftIcon size={14} /> Voltar ao estúdio
          </Link>
        </div>
      </>
    );
  }

  const viewer = meeting.viewer || {};
  const canManage = Boolean(viewer.canManage || viewer.is_host || viewer.is_admin || viewer.is_owner);
  const joinable = meeting.status === "active" || (meeting.status === "scheduled" && now !== null && new Date(meeting.starts_at).getTime() <= now);

  const classMap = {
    scheduled: styles.badgeScheduled,
    active: styles.badgeActive,
    ended: styles.badgeEnded,
    cancelled: styles.badgeCancelled,
  };

  const guestKeys = meeting.guest_keys || [];

  return (
    <>
      <SeoHead title={`${meeting.title} — Reunião`} description={meeting.description || `Reunião de ${meeting.org_name}`} />
      <div className={styles.page}>
        <div className={styles.head}>
          <div className={styles.titleGroup}>
            <Link href={`/estudios/${slug}/reunioes`} className={styles.backLink}>
              <ArrowLeftIcon size={14} /> Reuniões de {meeting.org_name}
            </Link>
          </div>
        </div>

        {flash && (
          <div className={`${styles.statusBlock} ${flash.type === "ok" ? styles.statusInfo : styles.statusDanger}`}>
            {flash.type === "ok" ? <InfoIcon size={18} /> : <AlertIcon size={18} />}
            <p className={styles.statusText}>{flash.text}</p>
          </div>
        )}

        <div className={styles.card}>
          <div className={styles.cardAccent} />
          <div className={styles.cardBody}>
            {editing ? (
              <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="edit-title">
                    Título
                  </label>
                  <input
                    id="edit-title"
                    className={styles.input}
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="edit-desc">
                    Descrição
                  </label>
                  <textarea
                    id="edit-desc"
                    className={styles.textarea}
                    value={editDesc}
                    onChange={(event) => setEditDesc(event.target.value)}
                    maxLength={2000}
                  />
                </div>
                <div className={styles.actionsRow}>
                  <button type="submit" className={styles.btnPrimary} disabled={busy === "save"}>
                    {busy === "save" ? <Spinner size="small" /> : <CheckIcon size={14} />} Salvar
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className={styles.cardHead}>
                  <h1 className={styles.bigTitle}>{meeting.title}</h1>
                  <span className={`${styles.badge} ${classMap[meeting.status] ?? ""}`}>{STATUS_LABELS[meeting.status] ?? meeting.status}</span>
                </div>
                <div className={styles.metaList}>
                  {meeting.status === "scheduled" && (
                    <span className={styles.metaRow}>
                      <CalendarIcon size={14} /> {formatFull(meeting.starts_at)}
                      {meeting.ends_at && (
                        <>
                          <ClockIcon size={14} /> até{" "}
                          {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(meeting.ends_at))}
                        </>
                      )}
                    </span>
                  )}
                  {meeting.status === "active" && (
                    <span className={styles.metaRow}>
                      <VideoIcon size={14} /> Em andamento agora
                    </span>
                  )}
                  {meeting.status === "ended" && meeting.ended_at && (
                    <span className={styles.metaRow}>
                      <ClockIcon size={14} /> Encerrada em {formatFull(meeting.ended_at)}
                    </span>
                  )}
                  {meeting.status === "cancelled" && (
                    <span className={styles.metaRow}>
                      <AlertIcon size={14} /> Cancelada
                    </span>
                  )}
                  {meeting.created_by_username && (
                    <span className={styles.metaRow}>
                      <PeopleIcon size={14} /> Organizada por {meeting.created_by_username}
                    </span>
                  )}
                  <span className={styles.metaRow}>
                    <LinkIcon size={14} /> Código da reunião: {meeting.code}
                  </span>
                </div>
                {meeting.description && <p className={styles.description}>{meeting.description}</p>}

                <hr className={styles.divider} />

                <div className={styles.actionsRow}>
                  {joinable && (
                    <Link href={`/reuniao/${meeting.code}`} className={styles.btnPrimary}>
                      <VideoIcon size={14} /> Entrar na sala
                    </Link>
                  )}
                  {canManage && meeting.status === "scheduled" && (
                    <button type="button" className={styles.btnOutline} onClick={handleStart} disabled={busy === "start"}>
                      {busy === "start" ? <Spinner size="small" /> : <PlayIcon size={14} />} Iniciar agora
                    </button>
                  )}
                  {canManage && (meeting.status === "scheduled" || meeting.status === "active") && (
                    <>
                      <button type="button" className={styles.btnOutline} onClick={() => setEditing(true)} disabled={busy === "save"}>
                        <PencilIcon size={14} /> Editar
                      </button>
                      {meeting.status === "scheduled" && (
                        <button
                          type="button"
                          className={`${styles.btnOutline} ${styles.btnDanger}`}
                          onClick={handleCancel}
                          disabled={busy === "cancel"}
                        >
                          {busy === "cancel" ? <Spinner size="small" /> : <XIcon size={14} />} Cancelar reunião
                        </button>
                      )}
                      {meeting.status === "active" && (
                        <button type="button" className={`${styles.btnOutline} ${styles.btnDanger}`} onClick={handleEnd} disabled={busy === "end"}>
                          {busy === "end" ? <Spinner size="small" /> : <StopIcon size={14} />} Encerrar para todos
                        </button>
                      )}
                    </>
                  )}
                </div>

                {!canManage && (meeting.status === "active" || meeting.status === "scheduled") && (
                  <div className={styles.actionsRow}>
                    <button
                      type="button"
                      className={`${styles.btnOutline} ${styles.btnDanger}`}
                      onClick={() => {
                        setReportError(null);
                        setReportOpen(true);
                      }}
                    >
                      <AlertIcon size={14} /> Denunciar reunião
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {canManage && (meeting.status === "scheduled" || meeting.status === "active") && (
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <div className={styles.subGroup}>
                <div className={styles.subGroupHead}>
                  <h2 className={styles.subGroupTitle}>
                    <LinkIcon size={14} /> Links de convite
                  </h2>
                </div>
                <p className={styles.hint}>
                  Quem não é membro do estúdio entra por um link de convite temporário. Cada link pode ser revogado a qualquer momento.
                </p>

                <div className={styles.actionsRow}>
                  <label className={styles.fieldLabel} htmlFor="invite-ttl" style={{ margin: 0 }}>
                    Validade:
                  </label>
                  <select
                    id="invite-ttl"
                    className={styles.select}
                    style={{ width: "auto" }}
                    value={inviteTtl}
                    onChange={(event) => setInviteTtl(Number.parseInt(event.target.value, 10))}
                  >
                    {TTL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={styles.btnPrimary} onClick={handleCreateInvite} disabled={busy === "invite"}>
                    {busy === "invite" ? <Spinner size="small" /> : <LinkIcon size={14} />} Criar link de convite
                  </button>
                </div>

                {createdLink && (
                  <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0 }}>
                      <p className={styles.statusText} style={{ margin: 0 }}>
                        <strong>Novo link criado.</strong> Copie e envie para os convidados:
                      </p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <code className={styles.keyUrl} style={{ flex: 1, minWidth: 220 }}>
                          {createdLink}
                        </code>
                        <button type="button" className={styles.btnOutline} onClick={() => handleCopy(createdLink, "new")}>
                          {copiedId === "new" ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                          {copiedId === "new" ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.keyList}>
                  {guestKeys.length === 0 ? (
                    <p className={styles.hint}>Nenhum link criado ainda.</p>
                  ) : (
                    guestKeys.map((key) => (
                      <div className={styles.keyRow} key={key.id}>
                        <div className={styles.keyInfo}>
                          <span>
                            Criado em {formatDate(key.created_at)}
                            {key.last_used_at ? ` • usado em ${formatDate(key.last_used_at)}` : " • nunca usado"}
                          </span>
                          <span>
                            Expira em {formatDate(key.expires_at)} • {key.is_valid ? "válido" : key.revoked_at ? "revogado" : "expirado"}
                          </span>
                        </div>
                        <div className={styles.keyActions}>
                          {key.is_valid && (
                            <button
                              type="button"
                              className={`${styles.btnOutline} ${styles.btnDanger}`}
                              onClick={() => handleRevokeKey(key.id)}
                              disabled={busy === `revoke-${key.id}`}
                            >
                              <TrashIcon size={13} /> Revogar
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {meeting.status === "active" && (
          <div className={`${styles.statusBlock} ${styles.statusInfo}`}>
            <InfoIcon size={18} />
            <p className={styles.statusText}>
              {canManage
                ? "Você pode encerrar a reunião para todos a qualquer momento. Dentro da sala use os controles de câmera, microfone, tela e bate-papo."
                : "A reunião está acontecendo agora. Entre na sala para participar."}
            </p>
          </div>
        )}
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
