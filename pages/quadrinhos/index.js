import { useCallback, useEffect, useState } from "react";
import { Heading, TextInput, Spinner } from "@primer/react";
import { BookIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import BookCard from "@/components/Card/BookCard";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Quadrinhos e Livros — Indies Brasil";
const PAGE_DESCRIPTION = "Descubra quadrinhos, mangás, livros e publicações criadas por artistas e escritores indie brasileiros.";
const PAGE_URL = `${SITE_URL}/quadrinhos`;

const BOOK_TYPES = {
  book: "Livro",
  comic: "Quadrinho",
  manga: "Mangá",
  graphic_novel: "Romance Gráfico",
  zine: "Zine",
  artbook: "Artbook",
  rpg_manual: "Manual de RPG",
  other: "Outro",
};

const STAGES = {
  concept: "Conceito",
  writing: "Escrevendo",
  crowdfunding: "Financiamento Coletivo",
  production: "Em Produção",
  released: "Publicado",
  cancelled: "Cancelado",
};

const LIMIT = 24;

export default function QuadrinhosPage() {
  const { user } = useUser();
  const [tab, setTab] = useState("all");

  const [allBooks, setAllBooks] = useState([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allPage, setAllPage] = useState(1);
  const [allHasMore, setAllHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [bookType, setBookType] = useState("");
  const [stage, setStage] = useState("");

  const [followingBooks, setFollowingBooks] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  const loadAll = useCallback(async (pageNum, searchQuery, bookTypeQuery, stageQuery) => {
    setAllLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        limit: LIMIT,
        search: searchQuery,
        book_type: bookTypeQuery,
        stage: stageQuery,
      });
      const res = await fetch(`/api/v1/books?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setAllBooks((prev) => (pageNum === 1 ? data : [...prev, ...data]));
      setAllHasMore(data.length === LIMIT);
    } finally {
      setAllLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setAllPage(1);
      loadAll(1, search, bookType, stage);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, bookType, stage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allPage > 1) loadAll(allPage, search, bookType, stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPage]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowingLoading(true);
    fetch("/api/v1/books?isfollowing=true", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setFollowingBooks(Array.isArray(data) ? data : []))
      .catch(() => setFollowingBooks([]))
      .finally(() => setFollowingLoading(false));
  }, [user]);

  const activeList = tab === "following" ? followingBooks : allBooks;
  const isLoading = tab === "following" ? followingLoading : allLoading;

  const countNum = activeList.length;
  const countStr = countNum.toLocaleString("pt-BR");
  const countWord = countNum === 1 ? "publicação" : "publicações";

  let emptyTitle;
  if (tab === "following") {
    emptyTitle = "Você ainda não segue nenhuma publicação";
  } else if (search || bookType || stage) {
    emptyTitle = "Nenhuma publicação encontrada";
  } else {
    emptyTitle = "Ainda não há publicações cadastradas";
  }

  let emptyDescription;
  if (tab === "following") {
    emptyDescription = 'Vá para "Descubra" e comece a seguir!';
  } else if (search || bookType || stage) {
    emptyDescription = "Tente outros filtros.";
  } else {
    emptyDescription = "Seja o primeiro a cadastrar sua publicação!";
  }

  return (
    <div className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      <header className={styles.pageHeader}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTitle}>
            <Heading as="h2">Quadrinhos e Livros</Heading>
            {!isLoading && (
              <span className={styles.memberCount} aria-live="polite">
                {countStr} {countWord}
              </span>
            )}
          </div>
          <p className={styles.pageSubtitle}>Descubra quadrinhos, mangás, livros e publicações indie brasileiras.</p>

          {tab === "all" && (
            <div className={styles.searchWrapper}>
              <TextInput
                aria-label="Pesquisar publicações"
                placeholder="Pesquisar por título ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingVisual="search"
                className={styles.searchInput}
              />
              <div className={styles.selectRow}>
                <select className={styles.select} value={bookType} onChange={(e) => setBookType(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {Object.entries(BOOK_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select className={styles.select} value={stage} onChange={(e) => setStage(e.target.value)}>
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
          <div className={styles.feedTabs} role="tablist" aria-label="Filtros de publicações">
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

      {isLoading && (
        <div className={styles.loadingState} role="status" aria-live="polite">
          <Spinner size="medium" />
          <span>Carregando...</span>
        </div>
      )}

      {!isLoading && activeList.length === 0 && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <BookIcon size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        </div>
      )}

      {!isLoading && activeList.length > 0 && (
        <>
          <div className={styles.grid}>
            {activeList.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>

          {tab === "all" && allHasMore && (
            <div className={styles.loadMoreWrapper}>
              <button className={styles.loadMore} disabled={allLoading} onClick={() => setAllPage((p) => p + 1)}>
                {allLoading ? <Spinner size="small" /> : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
