import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { Spinner } from "@primer/react";
import { CalendarIcon, LocationIcon, BroadcastIcon, PersonIcon, ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL, OG_CARD_SIZE } from "@/lib/seo";
import { breadcrumbList, event as eventStructuredData, graph } from "@/lib/structured-data";
import { eventTypeLabel } from "@/lib/event-types";
import { allDayLastInstant, eventDateParts, formatEventDate, formatEventShortDate } from "@/lib/eventFormat";
import { loopbackOrigin } from "@/lib/internal-url";
import { isUuid } from "@/lib/uuid";
import CreatePost from "@/components/CreatePost/CreatePost";
import AddressDisplay from "@/components/Address/AddressDisplay";
import styles from "./index.module.css";
import { uploadWithProgress } from "@/utils/uploadWithProgress";

/**
 * Id de evento é UUID; qualquer outra coisa é tratada como inexistente.
 * Validação compartilhada com as outras rotas que recebem id (`lib/uuid.js`).
 */
/**
 * Busca o evento no servidor, antes do HTML sair.
 *
 * Sem isto os metadados não chegavam ao crawler: a página monta o `SeoHead` só
 * depois que o `useEffect` carrega o evento, e quem busca o link (WhatsApp,
 * Discord) **não executa JavaScript** — lia um HTML com zero meta tags e
 * compartilhava sem miniatura nenhuma.
 *
 * Os dados personalizados (`user_rsvp`, `is_owner`) continuam vindo do cliente,
 * que é quem tem sessão.
 */
export async function getServerSideProps(context) {
  const { id } = context.params;

  // Id validado antes de virar URL: um valor com `/` ou `..` escaparia do
  // caminho `/api/v1/events/` e traria outro endpoint interno para dentro das
  // props. Mesmo cuidado de `pages/posts/[id].jsx`.
  if (!isUuid(String(id))) {
    // Id que não é UUID também é "não encontrado" para quem pediu a página.
    context.res.statusCode = 404;
    return { props: { initialEvent: null, eventNotFound: true } };
  }

  try {
    // Loopback: de dentro do container a URL pública não resolve
    // (ver `lib/internal-url.js`).
    const res = await fetch(`${loopbackOrigin()}/api/v1/events/${id}`);
    if (res.status === 404) {
      // Evento inexistente sai do servidor já como 404, para o buscador não
      // indexar uma página vazia.
      context.res.statusCode = 404;
      return { props: { initialEvent: null, eventNotFound: true } };
    }
    if (!res.ok) {
      return { props: { initialEvent: null, eventNotFound: false } };
    }

    return { props: { initialEvent: await res.json(), eventNotFound: false } };
  } catch {
    // Falha de rede/banco não é "não existe": quem decide é o cliente, que
    // ainda pode buscar de novo.
    return { props: { initialEvent: null, eventNotFound: false } };
  }
}

/**
 * Formatação de data do evento: `lib/eventFormat.js`, que é quem sabe o fuso.
 *
 * A versão local usava `getDate()`/`getDay()`, isto é, o fuso de **quem executa**:
 * o SSR (container em UTC) gerava um HTML e o navegador em Brasília gerava outro
 * — mismatch de hidratação, e a versão indexada pelo Google era a de UTC.
 *
 * O dia do término de um evento de dia inteiro vem de `allDayLastInstant`: o
 * instante gravado é o **fim exclusivo** (00:00 do dia seguinte ao escolhido),
 * então exibi-lo direto mostraria um dia a mais.
 */
function eventEndForDisplay(ev) {
  return ev.is_all_day ? allDayLastInstant(ev.ends_at) : ev.ends_at;
}

/**
 * Mostra a linha "Término"?
 *
 * Com hora, sempre que início e término não forem o mesmo instante — a linha
 * acrescenta o horário. De dia inteiro, só quando muda o **dia**: o início é
 * 00:00 e o término é o dia seguinte, então o teste por instante daria sempre
 * verdadeiro e a linha repetiria a data de um evento de um só dia.
 */
function showsEndDate(ev) {
  if (!ev.is_all_day) return ev.ends_at !== ev.starts_at;

  const start = eventDateParts(ev.starts_at);
  const end = eventDateParts(eventEndForDisplay(ev));
  return !(start.year === end.year && start.month === end.month && start.day === end.day);
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EventDetailPage({ initialEvent = null, eventNotFound = false }) {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  // Estado inicial já vem do servidor: o HTML sai com os dados do evento — e,
  // quando o evento não existe, já sai com o estado "não encontrado".
  const [ev, setEv] = useState(initialEvent);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(!initialEvent && !eventNotFound);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [userRsvp, setUserRsvp] = useState(null);
  const [counts, setCounts] = useState({ going: 0, maybe: 0, not_going: 0 });
  const [userStudios, setUserStudios] = useState([]);
  const [orgRsvps, setOrgRsvps] = useState([]);
  const [orgRsvpLoading, setOrgRsvpLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");

  // Posts do evento: sempre do cliente. O crawler não precisa deles, e o SSR
  // já entregou o que os metadados usam.
  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    fetch(`/api/v1/events/${id}/posts`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Dados que dependem de sessão (`user_rsvp`, `is_owner`, `org_rsvps`) vêm do
  // cliente, que é quem tem cookie. A busca também roda quando o SSR não trouxe
  // nada (falha transitória), para a página não ficar presa em "carregando".
  //
  // O `loading` só é desligado aqui, nunca ligado: quando o SSR já desenhou a
  // página, ligar o carregamento de novo pisca a tela sem necessidade.
  const needsClientFetch = !initialEvent && !eventNotFound;

  useEffect(() => {
    if (!id || (!user?.id && !needsClientFetch)) return;

    let cancelled = false;
    fetch(`/api/v1/events/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        // Sem dados: se a página ainda não tinha evento (o SSR falhou), sai do
        // carregamento para mostrar o estado de erro, em vez de girar para
        // sempre. Se o SSR já desenhou, `loading` já era `false` — no-op.
        if (!data) {
          setLoading(false);
          return;
        }

        setEv(data);
        setUserRsvp(data.user_rsvp ?? null);
        setCounts({
          going: Number(data.rsvp_going ?? 0),
          maybe: Number(data.rsvp_maybe ?? 0),
          not_going: Number(data.rsvp_not_going ?? 0),
        });
        setOrgRsvps(Array.isArray(data.org_rsvps) ? data.org_rsvps : []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, user?.id, needsClientFetch]);

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
        const res = await fetch(`/api/v1/events/${id}/rsvp`, {
          method: "DELETE",
          credentials: "include",
        });
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

  async function handleAddPost(content, file = null, existingFormData = null, onProgress = null) {
    try {
      const formData = existingFormData || new FormData();
      if (!existingFormData) {
        formData.append("content", content);
        if (file) formData.append("file", file);
      }
      formData.append("event_id", id);
      const created = await uploadWithProgress("/api/v1/posts", {
        body: formData,
        onProgress,
      });
      setPosts((prev) => [created, ...prev]);
    } catch (err) {
      console.error("Erro ao criar post:", err);
      throw err;
    }
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
    await fetch(`/api/v1/events/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
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
        {/* Sem metadados a página sairia vazia para o buscador; com `noIndex`
            ele não guarda um resultado que não existe. Mesmo tratamento do
            "post não encontrado" (`pages/posts/[id].jsx`). */}
        <SeoHead
          title="Evento não encontrado — Indies Brasil"
          description="Este evento não foi encontrado na agenda do Indies Brasil."
          canonical={`${SITE_URL}/agenda/${id}`}
          noIndex
        />
        <p>Evento não encontrado.</p>
        <Link href="/agenda">← Voltar para a agenda</Link>
      </div>
    );
  }

  const pageTitle = `${ev.title} — Agenda Indies Brasil`;
  const pageUrl = `${SITE_URL}/agenda/${id}`;

  return (
    <>
      <SeoHead
        title={pageTitle}
        description={ev.description || ev.title}
        canonical={pageUrl}
        // Card gerado no servidor, com o mesmo fundo dos cards do site.
        ogImage={`${SITE_URL}/api/og/event/${id}`}
        // Medidas do arquivo que a rota acima gera (`renderPng` redimensiona
        // para `OG_WIDTH`x`OG_HEIGHT`). Sem isto o `SeoHead` cai no padrão da
        // arte do site (1424x747) e as redes dimensionam o card por um número
        // que não é o do arquivo — imagem esticada ou cortada.
        ogImageWidth={OG_CARD_SIZE.width}
        ogImageHeight={OG_CARD_SIZE.height}
        ogType="article"
        // Evento restrito não deve ser indexado — e o mesmo vale para
        // `members`: a regra de leitura é a de `visibilityCondition`
        // (`models/event.js`), em que só `public` é aberto a qualquer visitante.
        // O crawler recebe a versão 404 desta página (o SSR busca sem sessão),
        // então isto é a segunda linha de defesa, não a primeira.
        noIndex={ev.visibility !== "public"}
        jsonLd={graph(
          breadcrumbList([
            { name: "Agenda", path: "/agenda" },
            { name: ev.title, path: `/agenda/${id}` },
          ]),
          eventStructuredData({
            name: ev.title,
            description: ev.description,
            startDate: ev.starts_at,
            endDate: ev.ends_at,
            image: `${SITE_URL}/api/og/event/${id}`,
            url: pageUrl,
            status: ev.status,
            isOnline: ev.is_online,
            locationName: ev.location_name,
            locationUrl: ev.location_url,
            address: ev.address,
            onlineUrl: ev.online_url,
            // `Person`, não `Organization`: é o que a página mostra — o card do
            // organizador é `@username` linkando para `/perfil/<username>`.
            // Declarar organização aqui descreveria algo que a página não exibe.
            organizerType: "Person",
            organizerName: ev.organizer_username,
            organizerUrl: ev.organizer_username ? `${SITE_URL}/perfil/${ev.organizer_username}` : null,
          }),
        )}
      />

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

        {/* HEADER CARD */}
        <div className={styles.headerCard}>
          {/* Sem capa o card não abre com uma faixa vazia: ele começa no título
              e a identidade fica com a barra da marca (`.headerCard::before`).
              Em 16:9 o placeholder seriam 487px de gradiente vazio. */}
          {ev.banner_url && (
            <div className={styles.bannerWrap}>
              <Image
                src={ev.banner_url}
                alt={ev.title}
                fill
                className={styles.banner}
                sizes="(max-width: 932px) calc(100vw - 34px), 866px"
                priority
              />
            </div>
          )}

          <div className={styles.headerContent}>
            <div className={styles.header}>
              <div className={styles.badges}>
                <span className={`${styles.typeBadge} ${styles[ev.event_type]}`}>{eventTypeLabel(ev.event_type)}</span>
                {ev.status === "cancelled" && <span className={styles.cancelledBadge}>Cancelado</span>}
                {ev.visibility === "private" && <span className={styles.privateBadge}>🔒 Privado</span>}
                {ev.is_recurring && <span className={styles.recurringBadge}>🔁 Recorrente</span>}
              </div>
              <h1 className={styles.title}>{ev.title}</h1>
            </div>
          </div>
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
                    <span className={styles.instanceDate}>{formatEventShortDate(inst.starts_at)}</span>
                    {!ev.is_all_day && (
                      <span>
                        {/* `eventDateParts` traz a hora de Brasília — sem ele o SSR
                            (UTC) e o navegador discordariam do horário. */}
                        {eventDateParts(inst.starts_at).time}
                        {" – "}
                        {eventDateParts(inst.ends_at).time}
                      </span>
                    )}
                    {inst.override_title && (
                      <span
                        style={{
                          color: "var(--brand-primary)",
                          fontWeight: 600,
                        }}
                      >
                        {inst.override_title}
                      </span>
                    )}
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
                  {formatEventDate(ev.starts_at, { allDay: ev.is_all_day })}
                </div>
              </div>

              {showsEndDate(ev) && (
                <div className={styles.infoRow}>
                  <CalendarIcon size={16} className={styles.infoIcon} />
                  <div>
                    <div className={styles.infoLabel}>Término</div>
                    {formatEventDate(eventEndForDisplay(ev), { allDay: ev.is_all_day })}
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

              {ev.ticket_url && (
                <div className={styles.infoRow}>
                  <div style={{ width: "100%" }}>
                    <a
                      href={ev.ticket_url}
                      className={styles.infoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, fontSize: "0.95rem" }}
                    >
                      🎟️ Comprar ingresso ↗
                    </a>
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
                    style={{
                      textAlign: "center",
                      textDecoration: "none",
                      display: "block",
                    }}
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
