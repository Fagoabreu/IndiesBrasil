"use client";
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import styles from "./index.module.css";
import GameCard from "@/components/Card/GameCard";

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

export default function JogosPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const LIMIT = 20;

  const fetchGames = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 1 : page;
      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          page: currentPage,
          limit: LIMIT,
          search,
          genre,
          stage,
        });
        const res = await fetch(`/api/v1/games?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (reset) {
          setGames(data);
          setPage(2);
        } else {
          setGames((prev) => [...prev, ...data]);
          setPage((p) => p + 1);
        }
        setHasMore(data.length === LIMIT);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, genre, stage, page],
  );

  useEffect(() => {
    fetchGames(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, genre, stage]);

  return (
    <>
      <Head>
        <title>Jogos — Indies Brasil</title>
        <meta name="description" content="Descubra jogos criados por desenvolvedores indie brasileiros." />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Jogos</h1>
          <p className={styles.subtitle}>Descubra projetos de desenvolvedores indie brasileiros</p>
        </header>

        <div className={styles.filters}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar jogos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

        {loading ? (
          <div className={styles.spinner} />
        ) : games.length === 0 ? (
          <p className={styles.empty}>Nenhum jogo encontrado.</p>
        ) : (
          <>
            <div className={styles.grid}>
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
            {hasMore && (
              <button className={styles.loadMore} onClick={() => fetchGames(false)} disabled={loadingMore}>
                {loadingMore ? "Carregando..." : "Ver mais"}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
