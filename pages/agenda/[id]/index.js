import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { Spinner } from "@primer/react";
import { CalendarIcon, LocationIcon, BroadcastIcon, PersonIcon, ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import CreatePost from "@/components/CreatePost/CreatePost";
import AddressDisplay from "@/components/Address/AddressDisplay";
import styles from "./index.module.css";

const TYPE_LABELS = {
  general: "Geral",
  game_launch: "Lançamento de Jogo",
  game_jam: "Game Jam",
  stream_marathon: "Maratona de Stream",
  meeting: "Reunião",
  studio: "Evento de Estúdio",
};

const PT_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDateTime(dateStr, isAllDay) {
  const d = new Date(dateStr);
  const weekday = PT_WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = PT_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  if (isAllDay) return `${weekday}, ${day} de ${month} de ${year}`;
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${weekday}, ${day} de ${month} de ${year} às ${time}`;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return `${PT_WEEKDAYS[d.getDay()]}, ${d.getDate()}/${PT_MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EventDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  const [ev, setEv] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [userRsvp, setUserRsvp] = useState(null);
  const [counts, setCounts] = useState({ going: 0, maybe: 0, not_going: 0 });
  const [userStudios, setUserStudios] = useState([]);
  const [orgRsvps, setOrgRsvps] = useState([]);
  const [orgRsvpLoading, setOrgRsvpLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      try {
        const [evRes, postsRes] = await Promise.all([
          fetch(`/api/v1/events/${id}`, { credentials: "include" }),
          fetch(`/api/v1/events/${id}/posts`, { credentials: "include" }),
        ]);
        const evData = await evRes.json();
        const postsData = await postsRes.json();

        if (evRes.ok) {
          setEv(evData);
          setUserRsvp(evData.user_rsvp ?? null);
          setCounts({
            going: Number(evData.rsvp_going ?? 0),
            maybe: Number(evData.rsvp_maybe ?? 0),
            not_going: Number(evData.rsvp_not_going ?? 0),
          });
          setOrgRsvps(Array.isArray(evData.org_rsvps) ? evData.org_rsvps : []);
        }
        if (postsRes.ok) setPosts(Array.isArray(postsData) ? postsData : []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    fetch("/api/v1/studios?member=me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUserStudios(Array.isArray(data) ? data : []));
  }, [user]);

  async function handleRsvp(status) {
    if (!user || !id) return;
    setRsvpLoading(true);
    try {
      if (userRsvp === status) {
        const res = await fetch(`/api/v1/events/${id}/rsvp`, { method: "DELETE", credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          setUserRsvp(null);
          setCounts(data.counts);
        }
      } else {
        const res = await fetch(`/api/v1/events/${id}/rsvp`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await res.json();
        if (res.ok) {
          setUserRsvp(status);
          setCounts(data.counts);
        }
      }
    } finally {
      setRsvpLoading(false);
    }
  }

  function rsvpBtnClass(status) {
    const active = userRsvp === status;
    if (!active) return styles.rsvpBtn;
    return `${styles.rsvpBtn} ${styles.active} ${styles[status]}`;
  }

  async function handleAddPost(content, file = null) {
    const formData = new FormData();
    formData.append("content", content);
    formData.append("event_id", id);
    if (file) formData.append("file", file);
    const res = await fetch("/api/v1/posts", { method: "POST", credentials: "include", body: formData });
    if (!res.ok) return;
    const created = await res.json();
    setPosts((prev) => [created, ...prev]);
  }

  function isOrgGoing(orgId) {
    return orgRsvps.some((o) => o.organization_id === orgId);
  }

  async function handleOrgRsvp() {
    if (!selectedOrgId || !id) return;
    setOrgRsvpLoading(true);
    try {
      if (isOrgGoing(selectedOrgId)) {
        const res = await fetch(`/api/v1/events/${id}/org-rsvp`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: selectedOrgId }),
        });
        if (res.ok) {
          const data = await res.json();
          setOrgRsvps((prev) => prev.filter((o) => o.organization_id !== selectedOrgId));
          setCounts(data.counts);
        }
      } else {
        const res = await fetch(`/api/v1/events/${id}/org-rsvp`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: selectedOrgId }),
        });
        if (res.ok) {
          const data = await res.json();
          const studio = userStudios.find((s) => s.id === selectedOrgId);
          if (studio) {
            setOrgRsvps((prev) => [
              ...prev,
              {
                organization_id: studio.id,
                status: "going",
                org_slug: studio.slug,
                org_name: studio.name,
                org_logo_url: studio.logo_url,
              },
            ]);
          }
          setCounts(data.counts);
        }
      }
    } finally {
      setOrgRsvpLoading(false);
    }
  }

  async function handleCancel() {
    if (!ev || !user) return;
    if (!globalThis.confirm("Tem certeza que deseja cancelar este evento?")) return;
    await fetch(`/api/v1/events/${id}`, { method: "DELETE", credentials: "include" });
    router.push("/agenda");
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="large" />
      </div>
    );
  }

  if (!ev) {
    return (
      <div className={styles.notFound}>
        <p>Evento não encontrado.</p>
        <Link href="/agenda">← Voltar para a agenda</Link>
      </div>
    );
  }

  const pageTitle = `${ev.title} — Agenda Indies Brasil`;
  const pageUrl = `${SITE_URL}/agenda/${id}`;

  return (
    <>
      <SeoHead title={pageTitle} description={ev.description || ev.title} url={pageUrl} />

      {ev.banner_url ? (
        <Image src={ev.banner_url} alt={ev.title} width={900} height={260} className={styles.banner} />
      ) : (
        <div className={styles.bannerPlaceholder} />
      )}

      <div className={styles.page}>
        <Link
          href="/agenda"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.85rem",
            color: "var(--fgColor-muted)",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <ArrowLeftIcon size={14} /> Agenda
        </Link>

        <div className={styles.header}>
          <div className={styles.badges}>
            <span className={`${styles.typeBadge} ${styles[ev.event_type]}`}>{TYPE_LABELS[ev.event_type] ?? ev.event_type}</span>
            {ev.status === "cancelled" && <span className={styles.cancelledBadge}>Cancelado</span>}
            {ev.visibility === "private" && <span className={styles.privateBadge}>🔒 Privado</span>}
            {ev.is_recurring && <span className={styles.recurringBadge}>🔁 Recorrente</span>}
          </div>
          <h1 className={styles.title}>{ev.title}</h1>
        </div>

        <div className={styles.layout}>
          {/* ── COLUNA PRINCIPAL ── */}
          <div className={styles.main}>
            {ev.description && <p className={styles.description}>{ev.description}</p>}

            {ev.is_recurring && ev.upcoming_instances?.length > 1 && (
              <div className={styles.instancesSection}>
                <h2 className={styles.sectionTitle}>Próximas Ocorrências</h2>
                {ev.upcoming_instances.slice(0, 5).map((inst) => (
                  <div key={inst.id} className={styles.instanceItem}>
                    <span className={styles.instanceDate}>{formatShortDate(inst.starts_at)}</span>
                    {!ev.is_all_day && (
                      <span>
                        {new Date(inst.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(inst.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {inst.override_title && <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{inst.override_title}</span>}
                  </div>
                ))}
              </div>
            )}

            {orgRsvps.length > 0 && (
              <div className={styles.orgRsvpAttendees}>
                <div className={styles.orgRsvpAttendeesLabel}>Estúdios confirmados ({orgRsvps.length})</div>
                <div className={styles.orgRsvpAttendeesList}>
                  {orgRsvps.map((org) => (
                    <Link key={org.organization_id} href={`/estudios/${org.org_slug}`} className={styles.orgCard}>
                      {org.org_logo_url ? (
                        <Image src={org.org_logo_url} alt={org.org_name} width={38} height={38} className={styles.orgCardLogo} />
                      ) : (
                        <span className={styles.orgCardInitial}>{(org.org_name || "E")[0].toUpperCase()}</span>
                      )}
                      <span className={styles.orgCardName}>{org.org_name}</span>
                      <span className={styles.orgCardGoingBadge}>✓ Vai</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.postsSection}>
              <h2 className={styles.sectionTitle}>
                <CalendarIcon size={14} /> Posts sobre este evento ({posts.length})
              </h2>

              {user && (
                <div className={styles.createPostWrap}>
                  <CreatePost user={user} onPost={handleAddPost} />
                </div>
              )}

              {posts.length === 0 ? (
                <p className={styles.noPostsHint}>Nenhum post ainda. Seja o primeiro a comentar!</p>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className={styles.postCard}>
                    <div className={styles.postHeader}>
                      <Image
                        src={p.author_avatar_url || "/images/avatar.png"}
                        alt={p.author_username}
                        width={28}
                        height={28}
                        className={styles.postAvatar}
                      />
                      <Link href={`/perfil/${p.author_username}`} className={styles.postAuthor}>
                        @{p.author_username}
                      </Link>
                      <span className={styles.postDate}>{timeAgo(p.created_at)}</span>
                    </div>
                    {p.content && <p className={styles.postContent}>{p.content}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <div className={styles.sidebar}>
            <div className={styles.infoCard}>
              <div className={styles.infoRow}>
                <CalendarIcon size={16} className={styles.infoIcon} />
                <div>
                  <div className={styles.infoLabel}>Data de início</div>
                  {formatDateTime(ev.starts_at, ev.is_all_day)}
                </div>
              </div>

              {ev.ends_at !== ev.starts_at && (
                <div className={styles.infoRow}>
                  <CalendarIcon size={16} className={styles.infoIcon} />
                  <div>
                    <div className={styles.infoLabel}>Término</div>
                    {formatDateTime(ev.ends_at, ev.is_all_day)}
                  </div>
                </div>
              )}

              {ev.is_online && (
                <div className={styles.infoRow}>
                  <BroadcastIcon size={16} className={styles.infoIcon} />
                  <div>
                    <div className={styles.infoLabel}>Online</div>
                    {ev.online_url ? (
                      <a href={ev.online_url} className={styles.infoLink} target="_blank" rel="noopener noreferrer">
                        Acessar link do evento ↗
                      </a>
                    ) : (
                      "Link será divulgado em breve"
                    )}
                  </div>
                </div>
              )}
              {!ev.is_online && (ev.location_name || ev.address) && (
                <div className={styles.infoRow}>
                  <LocationIcon size={16} className={styles.infoIcon} />
                  <div style={{ width: "100%" }}>
                    <div className={styles.infoLabel}>Local</div>
                    <AddressDisplay address={ev.address} locationName={ev.location_name} locationUrl={ev.location_url} />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoLabel} style={{ marginBottom: 8 }}>
                <PersonIcon size={13} /> Organizador
              </div>
              <Link href={`/perfil/${ev.organizer_username}`} className={styles.organizer}>
                <Image
                  src={ev.organizer_avatar_url || "/images/avatar.png"}
                  alt={ev.organizer_username}
                  width={36}
                  height={36}
                  className={styles.organizerAvatar}
                />
                <div>
                  <div className={styles.organizerName}>@{ev.organizer_username}</div>
                  <div className={styles.organizerRole}>Organizador</div>
                </div>
              </Link>
            </div>

            {ev.status !== "cancelled" && (
              <div className={styles.rsvpCard}>
                <h3 className={styles.rsvpTitle}>Presença</h3>
                <div className={styles.rsvpCounts}>
                  <div className={styles.rsvpStat}>
                    <span className={`${styles.rsvpStatNum} ${styles.going}`}>{counts.going}</span>
                    <span className={styles.rsvpStatLabel}>Vão</span>
                  </div>
                  <div className={styles.rsvpStat}>
                    <span className={`${styles.rsvpStatNum} ${styles.maybe}`}>{counts.maybe}</span>
                    <span className={styles.rsvpStatLabel}>Talvez</span>
                  </div>
                  <div className={styles.rsvpStat}>
                    <span className={`${styles.rsvpStatNum} ${styles.not_going}`}>{counts.not_going}</span>
                    <span className={styles.rsvpStatLabel}>Não vão</span>
                  </div>
                </div>

                {user ? (
                  <>
                    <div className={styles.rsvpBtns}>
                      <button type="button" className={rsvpBtnClass("going")} onClick={() => handleRsvp("going")} disabled={rsvpLoading}>
                        ✅ {userRsvp === "going" ? "Confirmado!" : "Vou!"}
                      </button>
                      <button type="button" className={rsvpBtnClass("maybe")} onClick={() => handleRsvp("maybe")} disabled={rsvpLoading}>
                        🤔 {userRsvp === "maybe" ? "Marcado como talvez" : "Talvez"}
                      </button>
                      <button type="button" className={rsvpBtnClass("not_going")} onClick={() => handleRsvp("not_going")} disabled={rsvpLoading}>
                        ❌ {userRsvp === "not_going" ? "Marcado como não vou" : "Não vou"}
                      </button>
                    </div>

                    {userStudios.length > 0 && (
                      <div className={styles.orgRsvpSection}>
                        <div className={styles.orgRsvpLabel}>Confirmar como estúdio</div>
                        <div className={styles.orgRsvpRow}>
                          <select className={styles.orgRsvpSelect} value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
                            <option value="">Selecione um estúdio…</option>
                            {userStudios.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={`${styles.rsvpBtn} ${selectedOrgId && isOrgGoing(selectedOrgId) ? `${styles.active} ${styles.going}` : ""}`}
                            onClick={handleOrgRsvp}
                            disabled={!selectedOrgId || orgRsvpLoading}
                          >
                            {orgRsvpLoading
                              ? "…"
                              : selectedOrgId && isOrgGoing(selectedOrgId)
                                ? "✅ Confirmado — clique para cancelar"
                                : "Confirmar presença"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className={styles.loginHint}>
                    <Link href="/login" className={styles.loginLink}>
                      Faça login
                    </Link>{" "}
                    para confirmar presença.
                  </p>
                )}
              </div>
            )}

            {ev.is_owner && (
              <div className={styles.infoCard}>
                <div className={styles.infoLabel} style={{ marginBottom: 8 }}>
                  Gerenciar
                </div>
                <div className={styles.ownerActions}>
                  <Link
                    href={`/agenda/${id}/editar`}
                    className={styles.ownerBtn}
                    style={{ textAlign: "center", textDecoration: "none", display: "block" }}
                  >
                    ✏️ Editar
                  </Link>
                  <button
                    type="button"
                    className={`${styles.ownerBtn} ${styles.ownerBtnDanger}`}
                    onClick={handleCancel}
                    disabled={ev.status === "cancelled"}
                  >
                    🗑 Cancelar evento
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
