"use client";
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import styles from "./index.module.css";

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

function GameCard({ game }) {
  const stageLabel = STAGES[game.stage] ?? game.stage;

  return (
    <Link href={`/jogos/${game.slug}`} className={styles.card}>
      <div className={styles.cardCover}>
        {game.cover_url ? (
          <Image src={game.cover_url} alt={game.name} fill sizes="280px" className={styles.coverImg} />
        ) : (
          <div className={styles.coverPlaceholder}>
            <span>{game.name[0]}</span>
          </div>
        )}
        <span className={`${styles.stageBadge} ${styles[`stage_${game.stage}`]}`}>{stageLabel}</span>
      </div>

      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{game.name}</h2>
        {game.short_description && <p className={styles.cardDesc}>{game.short_description}</p>}

        <div className={styles.cardMeta}>
          {game.studio_name && (
            <span className={styles.studioLabel} title={game.studio_name}>
              {game.studio_name}
            </span>
          )}
          {game.genre && game.genre !== "Indefinido" && <span className={styles.genreBadge}>{game.genre}</span>}
        </div>

        {(game.avg_rating > 0 || game.follower_count > 0) && (
          <div className={styles.cardStats}>
            {game.avg_rating > 0 && <span className={styles.rating}>★ {Number(game.avg_rating).toFixed(1)}</span>}
            {game.follower_count > 0 && <span className={styles.followers}>♥ {game.follower_count}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
