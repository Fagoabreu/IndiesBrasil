import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Heading, Spinner, TextInput, Flash } from "@primer/react";
import { SearchIcon, ToolsIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import StudioCard from "@/components/Card/StudioCard";
import { useUser } from "@/context/UserContext";
import { SERVICE_GROUPS, groupServices } from "@/lib/serviceGroups";
import { SITE_URL } from "@/lib/seo";
import { resolveStudioEntry } from "@/lib/studioEntry";
import styles from "./index.module.css";

const PAGE_TITLE = "Serviços — Indies Brasil";
const PAGE_DESCRIPTION =
  "Encontre estúdios indie brasileiros que prestam desenvolvimento, portabilidade, arte, áudio, QA, localização, publicação e consultoria para o seu jogo.";
const PAGE_URL = `${SITE_URL}/servicos`;
const LIMIT = 20;

/**
 * Diretório de serviços prestados por estúdios.
 *
 * É uma **visão de estúdios**, não uma entidade nova: quem procura um serviço
 * quer o estúdio para contratar, então a listagem é a mesma de `/estudios` com
 * um filtro a mais (`?service=`). Duas listagens de estúdio com paginação,
 * moderação e card separados divergiriam — e a de serviço teria de lembrar de
 * repetir o filtro de estúdio bloqueado.
 *
 * A primeira página monta no servidor com `<a href="/estudios/<slug>">`: sem
 * isso o HTML é um spinner e nenhum link, e o Google não chega ao estúdio (a
 * mesma razão documentada em `pages/jogos/index.js`).
 */
export async function getServerSideProps() {
  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:studio")) return { notFound: true };

  const organization = (await import("@/models/organization")).default;
  const service = (await import("@/models/service")).default;

  const [studios, services] = await Promise.all([organization.findAll({ page: 1, limit: LIMIT }), service.findAll()]);

  // `Date` em props quebra a rota (o Next não serializa o que o node-pg devolve).
  return {
    props: {
      initialStudios: JSON.parse(JSON.stringify(studios)),
      initialServices: JSON.parse(JSON.stringify(services)),
    },
  };
}

export default function ServicosPage({ initialStudios, initialServices }) {
  const router = useRouter();
  const { user, loadingUser, myStudios } = useUser();

  const group = typeof router.query.grupo === "string" ? router.query.grupo : "";
  const service = typeof router.query.servico === "string" ? router.query.servico : "";

  const [studios, setStudios] = useState(initialStudios);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialStudios.length === LIMIT);

  const [search, setSearch] = useState(typeof router.query.q === "string" ? router.query.q : "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  function setFilter(key, value) {
    const next = { ...router.query };
    if (value) next[key] = value;
    else delete next[key];
    // Trocar de serviço também limpa o grupo: manter os dois pode produzir uma
    // combinação impossível (grupo A + serviço do grupo B) e a lista vazia
    // pareceria defeito.
    if (key === "servico") delete next.grupo;
    delete next.q;
    router.replace({ query: next }, undefined, { shallow: true });
  }

  // A primeira página veio do servidor; a montagem roda o efeito também, e
  // refazer a mesma busca trocaria os cards do HTML por um spinner.
  const skipInitialLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      if (!group && !service && !debouncedSearch) return;
    }

    const params = new URLSearchParams({ page: "1", limit: String(LIMIT) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (service) params.set("service", service);

    Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/studios?${params}`);
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(data.message || "Não foi possível carregar os estúdios.");
          setStudios([]);
          setHasMore(false);
          return;
        }

        // O filtro de grupo é aplicado aqui porque a API filtra por **serviço**,
        // não por grupo: o grupo é estrutura de apresentação (ver
        // `lib/serviceGroups.js`) e não existe como coluna.
        const rows = Array.isArray(data) ? data : [];
        setStudios(group ? rows.filter((studio) => matchesGroup(studio, group)) : rows);
        setPage(1);
        setHasMore(rows.length === LIMIT);
      } catch {
        if (!cancelled) setError("Não foi possível carregar os estúdios.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [group, service, debouncedSearch]);

  async function loadMore() {
    const nextPage = page + 1;
    const params = new URLSearchParams({ page: String(nextPage), limit: String(LIMIT) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (service) params.set("service", service);

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/studios?${params}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Não foi possível carregar mais estúdios.");
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      const filtered = group ? rows.filter((studio) => matchesGroup(studio, group)) : rows;

      setStudios((previous) => [...previous, ...filtered]);
      setPage(nextPage);
      setHasMore(rows.length === LIMIT);
    } catch {
      setError("Não foi possível carregar mais estúdios.");
    } finally {
      setLoading(false);
    }
  }

  const groupedServices = groupServices(initialServices);
  const visibleServices = group ? groupedServices.filter((item) => item.key === group) : groupedServices;

  const count = studios.length;
  const entry = resolveStudioEntry({ user, loadingUser, studios: myStudios, tab: "services" });
  const hasFilters = Boolean(group || service || search);

  return (
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      <div className={styles.page}>
        <header className={styles.header}>
          <Heading as="h1" className={styles.title}>
            Serviços
          </Heading>
          <p className={styles.subtitle}>
            Estúdios indie brasileiros que prestam serviço para outros times: desenvolvimento, portabilidade, arte, áudio, QA, localização, publicação
            e consultoria.
          </p>

          <div className={styles.offerRow}>
            <span className={styles.offerText}>É um estúdio e quer aparecer aqui?</span>
            <Link href={entry.href} className={styles.offerLink}>
              {entry.label}
            </Link>
            <span className={styles.offerDivider} aria-hidden="true">
              ·
            </span>
            <Link href="/servicos/sugerir" className={styles.offerMuted}>
              Faltou um serviço? Sugira
            </Link>
          </div>
        </header>

        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <SearchIcon size={14} />
            <TextInput
              aria-label="Buscar estúdios por serviço"
              placeholder="Buscar por estúdio ou serviço (ex: QA, portabilidade)…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.searchInput}
              block
            />
          </div>

          <div className={styles.chipRow} role="group" aria-label="Filtrar por grupo de serviço">
            <button type="button" className={`${styles.chip} ${!group ? styles.chipActive : ""}`} onClick={() => setFilter("grupo", "")}>
              Todos
            </button>
            {SERVICE_GROUPS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.chip} ${group === item.key ? styles.chipActive : ""}`}
                onClick={() => setFilter("grupo", group === item.key ? "" : item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.serviceRow}>
            <label className={styles.selectLabel}>
              Serviço
              <select className={styles.select} value={service} onChange={(event) => setFilter("servico", event.target.value)}>
                <option value="">Todos os serviços</option>
                {visibleServices.map((item) => (
                  <optgroup key={item.key} label={item.label}>
                    {item.services.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.name}
                        {option.usage_count > 0 ? ` (${option.usage_count})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {hasFilters && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => {
                  setSearch("");
                  router.replace({ query: {} }, undefined, { shallow: true });
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {error && <Flash variant="danger">{error}</Flash>}

        {studios.length === 0 && !loading && !error && (
          <div className={styles.empty}>
            <ToolsIcon size={32} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>{hasFilters ? "Nenhum estúdio oferece esse filtro ainda" : "Nenhum estúdio cadastrou serviços ainda"}</p>
            <p className={styles.emptyText}>
              {hasFilters
                ? "Tente outro serviço ou limpe os filtros."
                : "Quem tem estúdio pode declarar os serviços que presta e aparecer aqui — inclusive para receber contato de outros times."}
            </p>
            <Link href={entry.href} className={styles.emptyAction}>
              {entry.label}
            </Link>
          </div>
        )}

        <ul className={styles.grid}>
          {studios.map((studio) => (
            <StudioCard key={studio.id} studio={studio} />
          ))}
        </ul>

        {loading && (
          <div className={styles.loading}>
            <Spinner size="small" />
          </div>
        )}

        {hasMore && !loading && (
          <div className={styles.moreRow}>
            <button type="button" className={styles.moreButton} onClick={loadMore}>
              Carregar mais
            </button>
          </div>
        )}

        {count > 0 && (
          <p className={styles.count}>
            {count.toLocaleString("pt-BR")} {count === 1 ? "estúdio" : "estúdios"}
            {hasMore ? " (há mais)" : ""}
          </p>
        )}
      </div>
    </>
  );
}

/** O serviço do estúdio pertence ao grupo pedido? O grupo vem do catálogo. */
function matchesGroup(studio, groupKey) {
  return (studio.services ?? []).some((service) => service.group_key === groupKey);
}
