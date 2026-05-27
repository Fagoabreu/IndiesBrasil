"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import GameMediaPlayer from "@/components/GameMedia/GameMediaPlayer";
import GameReviews from "@/components/GameReviews/GameReviews";
import styles from "./boardgame.module.css";

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

function formatPlayerCount(min, max) {
  if (!min) return null;
  if (!max || min === max) return `${min} jogador${min > 1 ? "es" : ""}`;
  return `${min}\u2013${max} jogadores`;
}

function formatPlayTime(min, max) {
  if (!min) return null;
  if (!max || min === max) return `${min} min`;
  return `${min}\u2013${max} min`;
}

function getFollowLabel(loading, following) {
  if (loading) return "\u2026";
  return following ? "\u2713 Seguindo" : "+ Seguir";
}

export default function BoardgamePage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [bgData, setBgData] = useState(null);
  const [bgMedia, setBgMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchBoardgame = useCallback(async () => {
    if (!slug) return;
    try {
      const [bgRes, mediaRes] = await Promise.all([
        fetch(`/api/v1/boardgames/${slug}`, { credentials: "include" }),
        fetch(`/api/v1/boardgames/${slug}/media`, { credentials: "include" }),
      ]);
      if (!bgRes.ok) {
        router.replace("/jogos-de-mesa");
        return;
      }
      const data = await bgRes.json();
      setBgData(data);
      setFollowing(data.viewer?.isFollowing ?? false);
      if (mediaRes.ok) {
        setBgMedia(await mediaRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchBoardgame();
  }, [fetchBoardgame]);

  async function handleFollow() {
    if (!user) {
      router.push("/login");
      return;
    }
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/boardgames/${slug}/follow`, {
        method,
        credentials: "include",
      });
      if (res.ok) setFollowing(!following);
    } finally {
      setFollowLoading(false);
    }
  }

  if (loadingUser || loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!bgData) return null;

  const categoryLabel = CATEGORIES[bgData.category] ?? bgData.category;
  const stageLabel = STAGES[bgData.stage] ?? bgData.stage;
  const playerCount = formatPlayerCount(bgData.player_count_min, bgData.player_count_max);
  const playTime = formatPlayTime(bgData.play_time_min, bgData.play_time_max);

  return (
    <>
      <Head>
        <title>{bgData.name} — Indies Brasil</title>
        <meta name="description" content={bgData.short_description || bgData.name} />
      </Head>

      <div className={styles.page}>
        <div className={styles.content}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <Link href="/jogos-de-mesa">Jogos de Mesa</Link>
            <span> / </span>
            <span>{bgData.name}</span>
          </nav>

          {/* Hero ao estilo Steam */}
          <div className={styles.gameHero}>
            <GameMediaPlayer media={bgMedia} bannerUrl={bgData.banner_url} name={bgData.name} />

            {/* Painel direito: informações */}
            <div className={styles.heroInfo}>
              {(bgData.banner_url || bgData.cover_url) && (
                <div className={styles.heroCoverWrap}>
                  <Image src={bgData.banner_url || bgData.cover_url} alt={bgData.name} fill sizes="320px" priority className={styles.heroCoverImg} />
                </div>
              )}
              <h1 className={styles.heroGameName}>{bgData.name}</h1>
              {bgData.short_description && <p className={styles.heroTagline}>{bgData.short_description}</p>}
              <hr className={styles.heroDivider} />
              <dl className={styles.heroMeta}>
                <div className={styles.heroMetaRow}>
                  <dt className={styles.heroMetaLabel}>Categoria</dt>
                  <dd className={styles.heroMetaValue}>{categoryLabel}</dd>
                </div>
                <div className={styles.heroMetaRow}>
                  <dt className={styles.heroMetaLabel}>Fase</dt>
                  <dd className={styles.heroMetaValue}>{stageLabel}</dd>
                </div>
                {playerCount && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Jogadores</dt>
                    <dd className={styles.heroMetaValue}>{playerCount}</dd>
                  </div>
                )}
                {playTime && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Duração</dt>
                    <dd className={styles.heroMetaValue}>{playTime}</dd>
                  </div>
                )}
                {bgData.studio_name && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Estúdio</dt>
                    <dd className={styles.heroMetaValue}>
                      {bgData.studio_slug ? (
                        <Link href={`/estudios/${bgData.studio_slug}`} className={styles.heroMetaLink}>
                          {bgData.studio_name}
                        </Link>
                      ) : (
                        bgData.studio_name
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Layout principal */}
          <div className={styles.layout}>
            <main className={styles.main}>
              {bgData.description && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Sobre o jogo</h2>
                  <div className={styles.description}>
                    {bgData.description.split("\n").map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </section>
              )}

              {bgData.mechanics?.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Mecânicas</h2>
                  <ul className={styles.mechanicsList}>
                    {bgData.mechanics.map((m) => (
                      <li key={m} className={styles.mechanic}>
                        {m}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Avaliações */}
              <GameReviews
                reviewsApiUrl={`/api/v1/boardgames/${slug}/reviews`}
                avgRating={bgData.avg_rating}
                reviewCount={Number(bgData.review_count ?? 0)}
                userReview={bgData.viewer?.userReview ?? null}
                user={user}
                onReviewChange={fetchBoardgame}
              />
            </main>

            <aside className={styles.sidebar}>
              <button type="button" className={following ? styles.btnUnfollow : styles.btnFollow} onClick={handleFollow} disabled={followLoading}>
                {getFollowLabel(followLoading, following)}
              </button>

              {bgData.website_url && (
                <a href={bgData.website_url} target="_blank" rel="noopener noreferrer" className={styles.btnWebsite}>
                  Visitar site oficial
                </a>
              )}

              <dl className={styles.meta}>
                <div className={styles.metaRow}>
                  <dt>Categoria</dt>
                  <dd>{categoryLabel}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Fase</dt>
                  <dd>{stageLabel}</dd>
                </div>
                {playerCount && (
                  <div className={styles.metaRow}>
                    <dt>Jogadores</dt>
                    <dd>{playerCount}</dd>
                  </div>
                )}
                {playTime && (
                  <div className={styles.metaRow}>
                    <dt>Duração</dt>
                    <dd>{playTime}</dd>
                  </div>
                )}
                {bgData.age_rating != null && (
                  <div className={styles.metaRow}>
                    <dt>Idade mínima</dt>
                    <dd>{bgData.age_rating}+</dd>
                  </div>
                )}
                {bgData.weight != null && (
                  <div className={styles.metaRow}>
                    <dt>Peso</dt>
                    <dd>{Number(bgData.weight).toFixed(1)} / 5.0</dd>
                  </div>
                )}
                {bgData.release_date && (
                  <div className={styles.metaRow}>
                    <dt>Lançamento</dt>
                    <dd>{new Date(bgData.release_date).toLocaleDateString("pt-BR")}</dd>
                  </div>
                )}
                {bgData.studio_name && (
                  <div className={styles.metaRow}>
                    <dt>Estúdio</dt>
                    <dd>
                      {bgData.studio_slug ? (
                        <Link href={`/estudios/${bgData.studio_slug}`} className={styles.metaLink}>
                          {bgData.studio_name}
                        </Link>
                      ) : (
                        bgData.studio_name
                      )}
                    </dd>
                  </div>
                )}
                {Number(bgData.follower_count) > 0 && (
                  <div className={styles.metaRow}>
                    <dt>Seguidores</dt>
                    <dd>{Number(bgData.follower_count).toLocaleString("pt-BR")}</dd>
                  </div>
                )}
              </dl>

              {bgData.viewer?.canEdit && (
                <Link href={`/estudios/${bgData.studio_slug}/configuracoes`} className={styles.btnEdit}>
                  Editar jogo
                </Link>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
