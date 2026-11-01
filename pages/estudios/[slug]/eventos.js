import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon, PlusIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import EventForm from "@/components/Agenda/EventForm";
import EventCard from "@/components/Agenda/EventCard";
import applyBannerChange from "@/components/Agenda/applyBannerChange";
import { emptyEventValues, eventValuesFromApi } from "@/components/Agenda/eventFormOptions";
import { eventProductLabel } from "@/lib/event-products";
import { SITE_URL } from "@/lib/seo";
import styles from "./eventos.module.css";

/**
 * Agenda do estúdio.
 *
 * Segue o padrão de `reunioes.js` — SSR resolve o estúdio, o cliente busca o
 * `viewer` e decide o acesso, a lista vem por `fetch` —, mas aqui o conteúdo é a
 * **agenda** e o formulário é o mesmo `EventForm` da agenda geral.
 *
 * O que este lugar acrescenta ao `/agenda/criar`:
 *  - o evento nasce ligado ao estúdio (`organization_id` vem do endereço);
 *  - o formulário ganha o seletor de **produto relacionado** (jogo, jogo de
 *    mesa, livro, asset), que é o que transforma "evento" em "lançamento do
 *    jogo X";
 *  - a lista mostra também os eventos `private` do estúdio, que não aparecem na
 *    agenda pública — ver `visibilityCondition` em `models/event.js`.
 */
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

/** Os quatro catálogos do estúdio, na ordem em que o seletor os mostra. */
const PRODUCT_SOURCES = [
  { resource: "games", type: "game", label: "Jogo", nameKey: "name" },
  { resource: "boardgames", type: "boardgame", label: "Jogo de mesa", nameKey: "name" },
  { resource: "books", type: "book", label: "Livro ou quadrinho", nameKey: "title" },
  { resource: "assets", type: "asset", label: "Asset", nameKey: "name" },
];

export default function StudioEventsPage({ initialStudio, notFound }) {
  const { loadingUser } = useUser();

  const slug = initialStudio?.slug;
  const studioName = initialStudio?.name;
  const studioId = initialStudio?.id;

  const [viewer, setViewer] = useState(null);
  const [events, setEvents] = useState(null);
  const [products, setProducts] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canAccess = Boolean(viewer && (viewer.isMember || viewer.isAdmin || viewer.isOwner));

  useEffect(() => {
    if (!slug || notFound) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}`, { credentials: "include" });
        const data = await res.json();
        if (!cancelled) setViewer(data.viewer ?? {});
      } catch {
        if (!cancelled) setViewer({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, notFound]);

  useEffect(() => {
    if (!slug || !canAccess) return;
    let cancelled = false;

    (async () => {
      try {
        const query = showPast ? "?includePast=true" : "";
        const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}/events${query}`, { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.status_code) {
          setErrorMessage(data.message || "Não foi possível carregar a agenda.");
          setEvents([]);
          return;
        }
        setEvents(Array.isArray(data) ? data : []);
      } catch {
        if (cancelled) return;
        setErrorMessage("Erro de conexão ao carregar a agenda.");
        setEvents([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, canAccess, showPast, reloadKey]);

  /**
   * Catálogo do estúdio para o seletor de vínculo.
   *
   * Reaproveita as quatro rotas de listagem por estúdio que já existem — um
   * produto novo entra no seletor sem migration nem endpoint novo. Busca em
   * paralelo e tolera falha por catálogo: um erro em `assets` não pode impedir
   * a pessoa de vincular um jogo.
   */
  useEffect(() => {
    if (!slug || !canAccess) return;
    let cancelled = false;

    Promise.all(
      PRODUCT_SOURCES.map((source) =>
        fetch(`/api/v1/studios/${encodeURIComponent(slug)}/${source.resource}`, { credentials: "include" })
          .then((res) => (res.ok ? res.json() : []))
          .catch(() => []),
      ),
    ).then((results) => {
      if (cancelled) return;
      setProducts(
        results.flatMap((rows, index) => {
          const source = PRODUCT_SOURCES[index];
          return (Array.isArray(rows) ? rows : []).map((row) => ({
            type: source.type,
            id: row.id,
            name: row[source.nameKey],
            label: source.label,
          }));
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [slug, canAccess]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  function resetForms() {
    setCreating(false);
    setEditing(null);
    setErrorMessage(null);
  }

  async function handleCreate({ payload, banner }) {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      // O banner por link externo vai no corpo (não precisa de evento existente);
      // o arquivo sobe depois, porque a rota do banner exige o id.
      const body = banner.action === "external" ? { ...payload, banner_external_url: banner.externalUrl.trim() } : payload;

      const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Erro ao criar evento.");
        return;
      }

      await applyBannerChange(data.id, banner);
      resetForms();
      refresh();
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate({ payload, banner }) {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}/events/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Erro ao salvar as alterações.");
        return;
      }

      await applyBannerChange(editing.id, banner);
      resetForms();
      refresh();
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

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
        title={`Eventos de ${studioName} — Indies Brasil`}
        description={`Agenda de eventos do estúdio ${studioName}: lançamentos, streams e eventos presenciais.`}
        canonical={`${SITE_URL}/estudios/${slug}/eventos`}
        noIndex
      />

      <div className={styles.header}>
        <Link href={`/estudios/${slug}`} className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Voltar ao estúdio
        </Link>
        <h1 className={styles.pageTitle}>Eventos de {studioName}</h1>
        <p className={styles.pageSubtitle}>
          Lançamentos, streams e eventos do estúdio. Os públicos aparecem na <Link href="/agenda">agenda</Link>; os privados ficam só com a equipe.
        </p>
      </div>

      {viewer === null || loadingUser ? (
        <div className={styles.centerBox}>
          <Spinner size="medium" />
        </div>
      ) : !canAccess ? (
        <div className={styles.blockedBox}>
          <p className={styles.emptyMessage}>A agenda de eventos é exclusiva para membros, admins e o dono do estúdio.</p>
          <Link href={`/estudios/${slug}`} className={styles.submitBtn}>
            Ver página do estúdio
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => {
                setEditing(null);
                setCreating((value) => !value);
              }}
            >
              {creating ? (
                "Fechar"
              ) : (
                <>
                  <PlusIcon size={14} /> Criar evento
                </>
              )}
            </button>
            <label className={styles.pastToggle}>
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
              Mostrar eventos passados
            </label>
          </div>

          {errorMessage && <div className={styles.error}>{errorMessage}</div>}

          {creating && (
            <div className={styles.formCard}>
              <EventForm
                mode="create"
                initialValues={{ ...emptyEventValues(), organizationId: studioId || "" }}
                studioProducts={products}
                enableRecurrence
                error={errorMessage}
                submitting={submitting}
                onSubmit={handleCreate}
                cancelHref={`/estudios/${slug}/eventos`}
                submitLabel="Criar evento"
              />
            </div>
          )}

          {editing && (
            <div className={styles.formCard}>
              <EventForm
                mode="edit"
                initialValues={eventValuesFromApi(editing)}
                initialBannerUrl={editing.banner_url || null}
                studioProducts={products}
                error={errorMessage}
                submitting={submitting}
                onSubmit={handleUpdate}
                cancelHref={`/estudios/${slug}/eventos`}
                submitLabel="Salvar alterações"
              />
            </div>
          )}

          <section className={styles.listSection}>
            {events === null ? (
              <div className={styles.centerBox}>
                <Spinner size="medium" />
              </div>
            ) : events.length === 0 ? (
              <p className={styles.emptyMessage}>
                {showPast ? "Nenhum evento encontrado." : "Nenhum evento agendado. Crie o primeiro — lançamentos costumam ser o mais importante."}
              </p>
            ) : (
              <ul className={styles.eventList}>
                {events.map((item) => (
                  <li key={item.instance_id} className={styles.eventRow}>
                    <EventCard event={item} />
                    <div className={styles.eventActions}>
                      {item.product_name && <span className={styles.productTag}>{eventProductLabel(item.product_type, item.product_name)}</span>}
                      <Link href={`/agenda/${item.event_id}`} className={styles.actionLink}>
                        Ver
                      </Link>
                      <button type="button" className={styles.actionButton} onClick={() => openEdit(item)} disabled={submitting}>
                        Editar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );

  /**
   * Carrega o evento completo antes de abrir o formulário.
   *
   * A lista devolve a **instância** (data de cada ocorrência), mas o `EventForm`
   * espera o evento com `starts_at`/`ends_at` do evento e o endereço — editar a
   * partir da linha da lista sem buscar daria datas erradas em evento recorrente.
   */
  async function openEdit(item) {
    setCreating(false);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/events/${item.event_id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || "Não foi possível abrir o evento.");
        return;
      }
      setEditing(data);
    } catch {
      setErrorMessage("Erro de conexão ao abrir o evento.");
    }
  }
}

StudioEventsPage.propTypes = {
  initialStudio: PropTypes.shape({
    id: PropTypes.string,
    slug: PropTypes.string,
    name: PropTypes.string,
  }),
  notFound: PropTypes.bool,
};
