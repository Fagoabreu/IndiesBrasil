import { useRouter } from "next/router";
import { useState } from "react";
import { Spinner } from "@primer/react";
import { LockIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { SITE_URL } from "@/lib/seo";
import { formatMeetingRange, getMeetingPhase } from "@/lib/meetingFormat";
import styles from "./convidado.module.css";

export async function getServerSideProps(context) {
  const { meetingId } = context.params;
  try {
    const meeting = (await import("@/models/meeting")).default;
    const found = await meeting.findById(meetingId);
    const publicMeeting = meeting.serializeMeeting(found);
    delete publicMeeting.guest_code_hash;
    delete publicMeeting.room_id;
    return { props: { initialMeeting: JSON.parse(JSON.stringify(publicMeeting)) } };
  } catch {
    return { props: { notFound: true } };
  }
}

export default function GuestMeetingPage({ initialMeeting, notFound }) {
  const router = useRouter();
  const { meetingId } = router.query;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [joined, setJoined] = useState(null); // { meeting, joinUrl }

  const phase = initialMeeting ? getMeetingPhase(initialMeeting) : null;

  function normalizeCode(value) {
    return value
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8);
  }

  async function handleJoin(e) {
    e.preventDefault();
    setErrorMessage("");
    if (!code) {
      setErrorMessage("Informe o código de convidado.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/meetings/${encodeURIComponent(meetingId)}/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Código inválido ou expirado.");
        return;
      }
      setJoined({ meeting: data.meeting, joinUrl: data.joinUrl });
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function openRoom() {
    if (joined?.joinUrl) window.open(joined.joinUrl, "_blank", "noopener");
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <SeoHead title="Reunião não encontrada — Indies Brasil" noIndex />
        <div className={styles.card}>
          <p className={styles.errorMessage}>Este link de reunião é inválido ou foi removido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={`Reunião — ${initialMeeting.org_name} — Indies Brasil`}
        description="Entre em uma reunião do estúdio usando seu código de convidado."
        canonical={`${SITE_URL}/reunioes/${initialMeeting.id}`}
        noIndex
      />

      <div className={styles.card}>
        {joined ? (
          <>
            <h1 className={styles.title}>{joined.meeting.title}</h1>
            <p className={styles.orgName}>{joined.meeting.org_name}</p>
            <p className={styles.dateRow}>{formatMeetingRange(joined.meeting.starts_at, joined.meeting.ends_at)}</p>
            {joined.meeting.description && <p className={styles.description}>{joined.meeting.description}</p>}
            <button type="button" className={styles.joinBtn} onClick={openRoom}>
              Entrar na sala
            </button>
            {joined.meeting.created_by_username && <p className={styles.hint}>Organizada por {joined.meeting.created_by_username}.</p>}
          </>
        ) : (
          <>
            <h1 className={styles.title}>Entrar na reunião</h1>
            <p className={styles.orgName}>{initialMeeting.org_name}</p>
            <p className={styles.dateRow}>{formatMeetingRange(initialMeeting.starts_at, initialMeeting.ends_at)}</p>

            {phase === "cancelled" && <p className={styles.errorMessage}>Esta reunião foi cancelada.</p>}
            {phase === "ended" && <p className={styles.errorMessage}>Esta reunião já foi encerrada.</p>}

            {phase !== "cancelled" && phase !== "ended" && (
              <form className={styles.form} onSubmit={handleJoin}>
                <label className={styles.label} htmlFor="guest-code">
                  Código de convidado
                </label>
                <input
                  id="guest-code"
                  className={styles.input}
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  placeholder="8 caracteres"
                  autoComplete="one-time-code"
                  autoFocus
                />

                <label className={styles.label} htmlFor="guest-name">
                  Seu nome (opcional)
                </label>
                <input
                  id="guest-name"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como você quer aparecer na sala"
                  maxLength={40}
                />

                {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

                <button type="submit" className={styles.joinBtn} disabled={busy}>
                  {busy ? (
                    <>
                      <Spinner size="small" /> Validando…
                    </>
                  ) : (
                    <>
                      <LockIcon size={14} /> Validar código e entrar
                    </>
                  )}
                </button>

                <p className={styles.hint}>Peça o código ao organizador da reunião.</p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
