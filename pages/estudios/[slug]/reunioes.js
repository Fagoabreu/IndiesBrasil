import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import MeetingCreateForm from "@/components/Meetings/MeetingCreateForm";
import MeetingCard from "@/components/Meetings/MeetingCard";
import { SITE_URL } from "@/lib/seo";
import styles from "./reunioes.module.css";

export async function getServerSideProps(context) {
  const { slug } = context.params;
  try {
    const organization = (await import("@/models/organization")).default;
    const studio = await organization.findBySlug(slug);
    const serializedStudio = JSON.parse(JSON.stringify(studio));
    return { props: { initialStudio: serializedStudio } };
  } catch {
    return { props: { notFound: true } };
  }
}

export default function StudioMeetingsPage({ initialStudio, notFound }) {
  const { user: authUser, loadingUser } = useUser();

  const [viewer, setViewer] = useState(null);
  const [meetings, setMeetings] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  // Incrementado após ações (criar/cancelar/código) para recarregar a lista.
  const [reloadKey, setReloadKey] = useState(0);

  const slug = initialStudio?.slug;
  const studioName = initialStudio?.name;

  useEffect(() => {
    if (!slug || notFound) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled) setViewer(data.viewer ?? {});
      } catch {
        if (!cancelled) setViewer({});
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, notFound]);

  const canAccess = Boolean(viewer && (viewer.isMember || viewer.isAdmin || viewer.isOwner));

  useEffect(() => {
    if (!slug || !canAccess) return;
    let cancelled = false;
    const load = async () => {
      try {
        const query = showPast ? "?includePast=true" : "";
        const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}/meetings${query}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.status_code) {
          setErrorMessage(data.message || "Não foi possível carregar as reuniões.");
          setMeetings([]);
          return;
        }
        setMeetings(Array.isArray(data) ? data : []);
      } catch {
        if (cancelled) return;
        setErrorMessage("Erro de conexão ao carregar as reuniões.");
        setMeetings([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, canAccess, showPast, reloadKey]);

  if (notFound) {
    return (
      <div className={styles.page}>
        <SeoHead title="Estúdio não encontrado — Indies Brasil" noIndex />
        <p className={styles.emptyMessage}>Estúdio não encontrado.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={`Reuniões de ${studioName} — Indies Brasil`}
        description={`Reuniões e webconferências do estúdio ${studioName}.`}
        canonical={`${SITE_URL}/estudios/${slug}/reunioes`}
        noIndex
      />

      <div className={styles.header}>
        <Link href={`/estudios/${slug}`} className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Voltar ao estúdio
        </Link>
        <h1 className={styles.pageTitle}>Reuniões de {studioName}</h1>
        <p className={styles.pageSubtitle}>Agende webconferências do estúdio e convide pessoas externas com um código temporário.</p>
      </div>

      {viewer === null || loadingUser ? (
        <div className={styles.centerBox}>
          <Spinner size="medium" />
        </div>
      ) : !canAccess ? (
        <div className={styles.blockedBox}>
          <p className={styles.emptyMessage}>A área de reuniões é exclusiva para membros, admins e o dono do estúdio.</p>
          <Link href={`/estudios/${slug}`} className={styles.submitBtn}>
            Ver página do estúdio
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.submitBtn} onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Fechar" : "Agendar nova reunião"}
            </button>
            <label className={styles.pastToggle}>
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
              Mostrar reuniões passadas
            </label>
          </div>

          {showForm && (
            <MeetingCreateForm
              slug={slug}
              onCreated={() => {
                setShowForm(false);
                setReloadKey((k) => k + 1);
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {errorMessage && <div className={styles.error}>{errorMessage}</div>}

          <section className={styles.listSection}>
            {meetings === null ? (
              <div className={styles.centerBox}>
                <Spinner size="medium" />
              </div>
            ) : meetings.length === 0 ? (
              <p className={styles.emptyMessage}>{showPast ? "Nenhuma reunião encontrada." : "Nenhuma reunião agendada por enquanto."}</p>
            ) : (
              <ul className={styles.meetingList}>
                {meetings.map((meeting) => (
                  <li key={meeting.id}>
                    <MeetingCard meeting={meeting} viewer={viewer} authUser={authUser} slug={slug} onChanged={() => setReloadKey((k) => k + 1)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
