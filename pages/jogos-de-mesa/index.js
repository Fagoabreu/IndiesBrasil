"use client";
import { useCallback, useEffect, useState } from "react";
import { Heading, TextInput, Spinner } from "@primer/react";
import { TableIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import BoardGameCard from "@/components/Card/BoardGameCard";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Jogos de Mesa — Indies Brasil";
const PAGE_DESCRIPTION =
  "Descubra jogos de tabuleiro, cartas e RPGs criados por desenvolvedores indie brasileiros.";
const PAGE_URL = `${SITE_URL}/jogos-de-mesa`;

const CATEGORIES = {
  board_game: "Tabuleiro",
  card_game: "Cartas",
  rpg: "RPG de Mesa",
  dice_game: "Dados",
  miniature: "Miniaturas",
  party_game: "Party Game",
};

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  crowdfunding: "Financiamento Coletivo",
  production: "Em Produção",
  released: "Lançado",
  cancelled: "Cancelado",
};

const LIMIT = 20;

export default function JogosDeMessaPage() {
  const { user } = useUser();
  const [tab, setTab] = useState("all");

  // aba "Descubra"
  const [allGames, setAllGames] = useState([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allPage, setAllPage] = useState(1);
  const [allHasMore, setAllHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stage, setStage] = useState("");

  // aba "Seguindo"
  const [followingGames, setFollowingGames] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  const loadAll = useCallback(
    async (pageNum, searchQuery, categoryQuery, stageQuery) => {
      setAllLoading(true);
      try {
        const params = new URLSearchParams({
          page: pageNum,
          limit: LIMIT,
          search: searchQuery,
          category: categoryQuery,
          stage: stageQuery,
        });
        const res = await fetch(`/api/v1/boardgames?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setAllGames((prev) => (pageNum === 1 ? data : [...prev, ...data]));
        setAllHasMore(data.length === LIMIT);
      } finally {
        setAllLoading(false);
      }
    },
    [],
  );

  // Debounce filters for "Descubra"
  useEffect(() => {
    const t = setTimeout(() => {
      setAllPage(1);
      loadAll(1, search, category, stage);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, stage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allPage > 1) loadAll(allPage, search, category, stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPage]);

  // Load followed board games when user logs in
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowingLoading(true);
    fetch("/api/v1/boardgames?isfollowing=true", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setFollowingGames(Array.isArray(data) ? data : []))
      .catch(() => setFollowingGames([]))
      .finally(() => setFollowingLoading(false));
  }, [user]);

  const activeList = tab === "following" ? followingGames : allGames;
  const isLoading = tab === "following" ? followingLoading : allLoading;

  const countNum = activeList.length;
  const countStr = countNum.toLocaleString("pt-BR");
  const countWord = countNum === 1 ? "jogo" : "jogos";

  let emptyTitle;
  if (tab === "following") {
    emptyTitle = "Você ainda não segue nenhum jogo de mesa";
  } else if (search || category || stage) {
    emptyTitle = "Nenhum jogo encontrado";
  } else {
    emptyTitle = "Ainda não há jogos de mesa cadastrados";
  }

  let emptyDescription;
  if (tab === "following") {
    emptyDescription = 'Vá para "Descubra" e comece a seguir!';
  } else if (search || category || stage) {
    emptyDescription = "Tente outros filtros.";
  } else {
    emptyDescription = "Seja o primeiro a cadastrar o seu jogo!";
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical={PAGE_URL}
      />

      {/* PAGE HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTitle}>
            <Heading as="h2">Jogos de Mesa</Heading>
            {!isLoading && (
              <span className={styles.memberCount} aria-live="polite">
                {countStr} {countWord}
              </span>
            )}
          </div>
          <p className={styles.pageSubtitle}>
            Descubra jogos de tabuleiro, cartas e RPGs indie brasileiros.
          </p>

          {tab === "all" && (
            <div className={styles.searchWrapper}>
              <TextInput
                aria-label="Pesquisar jogos de mesa"
                placeholder="Pesquisar por nome ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingVisual="search"
                className={styles.searchInput}
              />
              <div className={styles.selectRow}>
                <select
                  className={styles.select}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option value="">Todas as fases</option>
                  {Object.entries(STAGES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {user && (
          <div
            className={styles.feedTabs}
            role="tablist"
            aria-label="Filtros de jogos de mesa"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={`${styles.feedTab} ${tab === "all" ? styles.feedTabActive : ""}`}
              onClick={() => setTab("all")}
            >
              Descubra
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "following"}
              className={`${styles.feedTab} ${tab === "following" ? styles.feedTabActive : ""}`}
              onClick={() => setTab("following")}
            >
              Seguindo
            </button>
          </div>
        )}
      </header>

      {/* LOADING */}
      {isLoading && (
        <div className={styles.loadingState} role="status" aria-live="polite">
          <Spinner size="medium" />
          <span>Carregando...</span>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && activeList.length === 0 && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <TableIcon size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        </div>
      )}

      {/* GRID */}
      {!isLoading && activeList.length > 0 && (
        <>
          <div className={styles.grid}>
            {activeList.map((bg) => (
              <BoardGameCard key={bg.id} boardgame={bg} />
            ))}
          </div>

          {tab === "all" && allHasMore && (
            <div className={styles.loadMoreWrapper}>
              <button
                className={styles.loadMore}
                disabled={allLoading}
                onClick={() => setAllPage((p) => p + 1)}
              >
                {allLoading ? <Spinner size="small" /> : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
