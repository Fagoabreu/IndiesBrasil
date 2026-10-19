import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Heading, Spinner, TextInput } from "@primer/react";
import { SearchIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import AssetCard from "@/components/Card/AssetCard";
import { ASSET_GROUPS, groupAssetCategories } from "@/lib/assetGroups";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Assets — Indies Brasil";
const PAGE_DESCRIPTION = "Pacotes de arte, áudio, interface, efeitos e código para game dev, publicados por estúdios brasileiros.";
const PAGE_URL = `${SITE_URL}/assets`;
const LIMIT = 20;

/**
 * A primeira página vem do servidor.
 *
 * Sem isso o HTML desta rota seria um spinner e nenhum `<a href="/assets/...">`
 * existiria antes de o navegador executar JavaScript — o Google só chegaria à
 * entidade se descobrisse o endereço sozinho. Mesma razão de `/jogos`.
 *
 * O gate é a mesma feature da rota de listagem (`read:asset:all`):
 * `getServerSideProps` não passa pelo middleware, então consulta a lista do
 * controller antes de ler o model.
 */
export async function getServerSideProps() {
  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:asset:all")) return { notFound: true };

  const asset = (await import("@/models/asset")).default;
  const assetCategory = (await import("@/models/assetCategory")).default;

  const [rows, categories] = await Promise.all([asset.findAll({ page: 1, limit: LIMIT }), assetCategory.findAll()]);

  // `Date` em props quebra a rota: o Next não serializa o que o node-pg devolve.
  return {
    props: {
      initialAssets: JSON.parse(JSON.stringify(rows)),
      initialCategories: JSON.parse(JSON.stringify(categories)),
    },
  };
}

export default function AssetsPage({ initialAssets, initialCategories }) {
  const router = useRouter();

  const group = typeof router.query.group === "string" ? router.query.group : "";
  const category = typeof router.query.category === "string" ? router.query.category : "";
  const free = router.query.free === "true";

  const [assets, setAssets] = useState(initialAssets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialAssets.length === LIMIT);

  const [search, setSearch] = useState(typeof router.query.q === "string" ? router.query.q : "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Troca um filtro no endereço: o link de categoria (`?category=`) abre a
  // mesma tela com o filtro aplicado, e recarregar a página preserva a escolha.
  function setFilter(key, value) {
    const next = { ...router.query };
    if (value) next[key] = value;
    else delete next[key];
    delete next.q;
    router.replace({ query: next }, undefined, { shallow: true });
  }

  // A primeira página já veio do servidor. A montagem roda este efeito também,
  // e refazer ali a mesma busca trocaria os cards do HTML por um spinner na
  // primeira passada do rastreador.
  const skipInitialLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      if (!group && !category && !free && !debouncedSearch) return;
    }

    const params = new URLSearchParams({ page: "1", limit: String(LIMIT) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (group) params.set("group", group);
    if (category) params.set("category", category);
    if (free) params.set("free", "true");

    // `Promise.resolve().then` mantém o `setState` fora do corpo do efeito —
    // `react-hooks/set-state-in-effect` acusa chamada síncrona aqui.
    Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/assets?${params}`);
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(data.message || "Não foi possível carregar os assets.");
          setAssets([]);
          setHasMore(false);
          return;
        }

        setAssets(Array.isArray(data) ? data : []);
        setPage(1);
        setHasMore(Array.isArray(data) && data.length === LIMIT);
      } catch {
        if (!cancelled) setError("Não foi possível carregar os assets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [group, category, free, debouncedSearch]);

  async function loadMore() {
    const nextPage = page + 1;
    const params = new URLSearchParams({ page: String(nextPage), limit: String(LIMIT) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (group) params.set("group", group);
    if (category) params.set("category", category);
    if (free) params.set("free", "true");

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/assets?${params}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Não foi possível carregar mais assets.");
        return;
      }

      setAssets((previous) => [...previous, ...(Array.isArray(data) ? data : [])]);
      setPage(nextPage);
      setHasMore(Array.isArray(data) && data.length === LIMIT);
    } catch {
      setError("Não foi possível carregar mais assets.");
    } finally {
      setLoading(false);
    }
  }

  const groupedCategories = groupAssetCategories(initialCategories);
  const visibleCategories = group ? groupedCategories.filter((item) => item.key === group) : groupedCategories;

  const count = assets.length;
  const countLabel = count === 1 ? "asset" : "assets";

  return (
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      <div className={styles.page}>
        <header className={styles.header}>
          <Heading as="h1" className={styles.title}>
            Assets
          </Heading>
          <p className={styles.subtitle}>
            Pacotes de arte, áudio, interface, efeitos e código para game dev. O site referencia o pacote — o download acontece no
            endereço de origem.
          </p>
        </header>

        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <SearchIcon size={14} />
            <TextInput
              aria-label="Buscar assets"
              placeholder="Buscar por nome ou descrição…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.searchInput}
              block
            />
          </div>

          <div className={styles.chipRow} role="group" aria-label="Filtrar por grupo">
            <button type="button" className={`${styles.chip} ${!group ? styles.chipActive : ""}`} onClick={() => setFilter("group", "")}>
              Todos
            </button>
            {ASSET_GROUPS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.chip} ${group === item.key ? styles.chipActive : ""}`}
                onClick={() => setFilter("group", group === item.key ? "" : item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.secondaryRow}>
            <label className={styles.selectLabel}>
              Categoria
              <select className={styles.select} value={category} onChange={(event) => setFilter("category", event.target.value)}>
                <option value="">Todas as categorias</option>
                {visibleCategories.map((item) => (
                  <optgroup key={item.key} label={item.label}>
                    {item.categories.map((option) => (
                      <option key={option.id} value={option.slug}>
                        {option.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={free}
                onChange={(event) => setFilter("free", event.target.checked ? "true" : "")}
              />
              Somente gratuitos
            </label>

            {(group || category || free || search) && (
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

        {error && <p className={styles.error}>{error}</p>}

        {assets.length === 0 && !loading && !error && (
          <p className={styles.empty}>Nenhum asset encontrado com esses filtros.</p>
        )}

        <div className={styles.grid}>
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>

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
            {count.toLocaleString("pt-BR")} {countLabel}
            {hasMore ? " (há mais)" : ""}
          </p>
        )}
      </div>
    </>
  );
}
