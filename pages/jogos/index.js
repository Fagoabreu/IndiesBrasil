"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Heading, TextInput, Spinner } from "@primer/react";
import { DeviceMobileIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import GameCard from "@/components/Card/GameCard";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Jogos — Indies Brasil";
const PAGE_DESCRIPTION = "Descubra jogos criados por desenvolvedores indie brasileiros.";
const PAGE_URL = `${SITE_URL}/jogos`;

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

const GENRES = [
  "Ação",
  "Aventura",
  "RPG",
  "Estratégia",
  "Simulação",
  "Puzzle",
  "Plataforma",
  "Corrida",
  "Esportes",
  "Terror",
  "Roguelike",
  "Indie",
  "Multiplayer",
  "Narrativo",
  "Indefinido",
];

const LIMIT = 20;

/**
 * A primeira página da listagem vem do servidor.
 *
 * Sem isso o HTML desta rota era um spinner: os cards só existiam depois que o
 * navegador rodava o JavaScript e chamava `/api/v1/games`. O Google até executa
 * JavaScript, mas então não havia nenhum `<a href="/jogos/...">` para descobrir
 * — a listagem não linkava para nada antes de rodar.
 *
 * Chamada ao model direto, e não à própria API por HTTP: é o mesmo dado que
 * `/api/v1/games` devolve (a rota repassa as linhas de `findAll` sem
 * enriquecimento) e evita uma requisição da máquina para ela mesma.
 *
 * O `JSON.parse(JSON.stringify(...))` converte os `Date` que o node-pg devolve
 * (ex.: `created_at`) em ISO — o Next não serializa `Date` em props.
 */
export async function getServerSideProps() {
  // `getServerSideProps` não passa pelo middleware (`controller.canRequest`),
  // então consulta a mesma lista do controller antes de ler o model. É o que
  // mantém "quem lê o quê" em um lugar só: revogar `read:game:all` do anônimo
  // derruba a API e esta página juntas (ver `infra/controller.js`).
  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:game:all")) return { notFound: true };

  const game = (await import("@/models/game")).default;
  const rows = await game.findAll({ page: 1, limit: LIMIT });

  return { props: { initialGames: JSON.parse(JSON.stringify(rows)) } };
}

export default function JogosPage({ initialGames }) {
  const { user } = useUser();
  const [tab, setTab] = useState("all");

  // aba "Descubra"
  const [allGames, setAllGames] = useState(initialGames);
  const [allLoading, setAllLoading] = useState(false);
  const [allPage, setAllPage] = useState(1);
  const [allHasMore, setAllHasMore] = useState(initialGames.length === LIMIT);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [stage, setStage] = useState("");

  // aba "Seguindo"
  const [followingGames, setFollowingGames] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  const loadAll = useCallback(async (pageNum, searchQuery, genreQuery, stageQuery) => {
    setAllLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        limit: LIMIT,
        search: searchQuery,
        genre: genreQuery,
        stage: stageQuery,
      });
      const res = await fetch(`/api/v1/games?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setAllGames((prev) => (pageNum === 1 ? data : [...prev, ...data]));
      setAllHasMore(data.length === LIMIT);
    } finally {
      setAllLoading(false);
    }
  }, []);

  // A primeira página já veio do servidor. O efeito de filtros roda também na
  // montagem, e refazer ali a mesma busca jogaria `allLoading` para `true` —
  // trocando os cards do HTML servido por um spinner bem na primeira passada do
  // rastreador. Só a primeira execução (com os filtros ainda vazios) é pulada;
  // qualquer digitação posterior carrega normalmente.
  const skipInitialLoad = useRef(true);

  // Debounce filters for "Descubra"
  useEffect(() => {
    const t = setTimeout(() => {
      setAllPage(1);

      if (skipInitialLoad.current) {
        skipInitialLoad.current = false;
        if (!search && !genre && !stage) return;
      }

      loadAll(1, search, genre, stage);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, genre, stage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allPage > 1) loadAll(allPage, search, genre, stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPage]);

  // Load followed games when user logs in
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowingLoading(true);
    fetch("/api/v1/games?isfollowing=true", { credentials: "include" })
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
    emptyTitle = "Você ainda não segue nenhum jogo";
  } else if (search || genre || stage) {
    emptyTitle = "Nenhum jogo encontrado";
  } else {
    emptyTitle = "Ainda não há jogos cadastrados";
  }

  let emptyDescription;
  if (tab === "following") {
    emptyDescription = 'Vá para "Descubra" e comece a seguir!';
  } else if (search || genre || stage) {
    emptyDescription = "Tente outros filtros.";
  } else {
    emptyDescription = "Seja o primeiro a cadastrar o seu jogo!";
  }

  return (
    <div className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      {/* PAGE HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTitle}>
            <Heading as="h2">Jogos</Heading>
            {!isLoading && (
              <span className={styles.memberCount} aria-live="polite">
                {countStr} {countWord}
              </span>
            )}
          </div>
          <p className={styles.pageSubtitle}>Descubra projetos de desenvolvedores indie brasileiros.</p>

          {tab === "all" && (
            <div className={styles.searchWrapper}>
              <TextInput
                aria-label="Pesquisar jogos"
                placeholder="Pesquisar por nome ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingVisual="search"
                className={styles.searchInput}
              />
              <div className={styles.selectRow}>
                <select className={styles.select} value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="">Todos os gêneros</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
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
          <div className={styles.feedTabs} role="tablist" aria-label="Filtros de jogos">
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
          <DeviceMobileIcon size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        </div>
      )}

      {/* GRID */}
      {!isLoading && activeList.length > 0 && (
        <>
          <div className={styles.grid}>
            {activeList.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i === 0} />
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
