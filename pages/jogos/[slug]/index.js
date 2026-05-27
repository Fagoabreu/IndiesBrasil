"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import GameMediaPlayer from "@/components/GameMedia/GameMediaPlayer";
import GameReviews from "@/components/GameReviews/GameReviews";
import styles from "./game.module.css";

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

const PLATFORM_ICONS = {
  windows: "🖥️",
  macos: "🍎",
  linux: "🐧",
  ps5: "🎮",
  ps4: "🎮",
  xbox_series: "🎮",
  xbox_one: "🎮",
  switch: "🕹️",
  ios: "📱",
  android: "📱",
  browser: "🌐",
};

const PLATFORM_LABELS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  ps5: "PS5",
  ps4: "PS4",
  xbox_series: "Xbox Series",
  xbox_one: "Xbox One",
  switch: "Switch",
  ios: "iOS",
  android: "Android",
  browser: "Navegador",
};

export default function GamePage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchGame = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/games/${slug}`, { credentials: "include" });
      if (!res.ok) {
        router.replace("/jogos");
        return;
      }
      const data = await res.json();
      setGameData(data);
      setFollowing(data.viewer?.isFollowing ?? false);
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  async function handleFollow() {
    if (!user) {
      router.push("/login");
      return;
    }
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/games/${slug}/follow`, {
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

  if (!gameData) return null;

  const { viewer } = gameData;

  return (
    <>
      <Head>
        <title>{gameData.name} — Indies Brasil</title>
        <meta name="description" content={gameData.short_description || gameData.name} />
      </Head>

      <div className={styles.page}>
        <div className={styles.content}>
          {/* ── Breadcrumb ── */}
          <nav className={styles.breadcrumb}>
            <Link href="/jogos">Jogos</Link>
            <span> / </span>
            <span>{gameData.name}</span>
          </nav>

          {/* ── Hero ao estilo Steam ── */}
          <div className={styles.gameHero}>
            {/* Painel esquerdo: player de mídia */}
            <GameMediaPlayer media={gameData.media || []} trailerUrl={gameData.trailer_url} bannerUrl={gameData.banner_url} name={gameData.name} />

            {/* Painel direito: informações do jogo */}
            <div className={styles.heroInfo}>
              {(gameData.banner_url || gameData.cover_url) && (
                <div className={styles.heroCoverWrap}>
                  <Image
                    src={gameData.banner_url || gameData.cover_url}
                    alt={gameData.name}
                    fill
                    sizes="320px"
                    priority
                    className={styles.heroCoverImg}
                  />
                </div>
              )}
              <h1 className={styles.heroGameName}>{gameData.name}</h1>
              {gameData.short_description && <p className={styles.heroTagline}>{gameData.short_description}</p>}
              <hr className={styles.heroDivider} />
              <dl className={styles.heroMeta}>
                <div className={styles.heroMetaRow}>
                  <dt className={styles.heroMetaLabel}>Todas as análises</dt>
                  <dd className={styles.heroMetaValue}>
                    {gameData.review_count > 0
                      ? `${Number(gameData.avg_rating).toFixed(1)} ★ (${gameData.review_count})`
                      : "Nenhuma análise de usuário"}
                  </dd>
                </div>
                <div className={styles.heroMetaRow}>
                  <dt className={styles.heroMetaLabel}>Lançamento</dt>
                  <dd className={styles.heroMetaValue}>
                    {gameData.release_date ? new Date(gameData.release_date).toLocaleDateString("pt-BR") : (STAGES[gameData.stage] ?? gameData.stage)}
                  </dd>
                </div>
                {gameData.studio_slug && (
                  <>
                    <div className={styles.heroMetaRow}>
                      <dt className={styles.heroMetaLabel}>Desenvolvedor</dt>
                      <dd className={styles.heroMetaValue}>
                        <Link href={`/estudios/${gameData.studio_slug}`} className={styles.heroMetaLink}>
                          {gameData.studio_name}
                        </Link>
                      </dd>
                    </div>
                    <div className={styles.heroMetaRow}>
                      <dt className={styles.heroMetaLabel}>Distribuidora</dt>
                      <dd className={styles.heroMetaValue}>
                        <Link href={`/estudios/${gameData.studio_slug}`} className={styles.heroMetaLink}>
                          {gameData.studio_name}
                        </Link>
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {gameData.tags?.length > 0 && (
                <div className={styles.heroTagsSection}>
                  <p className={styles.heroTagsLabel}>Marcadores populares para este produto:</p>
                  <div className={styles.heroTags}>
                    {gameData.tags.map((t) => (
                      <Link key={t.id} href={`/jogos?search=${encodeURIComponent(t.name)}`} className={styles.heroTag}>
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Layout principal ── */}
          <div className={styles.layout}>
            {/* ── Coluna esquerda: mídia ── */}
            <main className={styles.main}>
              {/* Descrição */}
              {gameData.description && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Sobre o jogo</h2>
                  <div className={styles.description}>
                    {gameData.description.split("\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* Avaliações */}
              <GameReviews
                reviewsApiUrl={`/api/v1/games/${slug}/reviews`}
                avgRating={gameData.avg_rating}
                reviewCount={Number(gameData.review_count ?? 0)}
                userReview={viewer?.userReview ?? null}
                user={user}
                onReviewChange={fetchGame}
              />
            </main>

            {/* ── Coluna direita: sidebar ── */}
            <aside className={styles.sidebar}>
              {/* Follow */}
              <button
                type="button"
                className={`${styles.btnFollow} ${following ? styles.btnFollowing : ""}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? "..." : following ? "✓ Seguindo" : "♥ Seguir"}
              </button>
              {gameData.follower_count > 0 && (
                <p className={styles.followerCount}>
                  {gameData.follower_count} seguidor{gameData.follower_count !== 1 ? "es" : ""}
                </p>
              )}

              {/* Links de lojas */}
              {gameData.store_pages?.length > 0 && (
                <div className={styles.storeLinks}>
                  {gameData.store_pages.map((sp) => (
                    <a key={sp.id} href={sp.page_url} target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
                      <span className={styles.storeName}>{sp.store_name}</span>
                      {sp.price != null ? (
                        <span className={styles.storePrice}>{Number(sp.price) === 0 ? "Grátis" : `R$ ${Number(sp.price).toFixed(2)}`}</span>
                      ) : null}
                    </a>
                  ))}
                </div>
              )}

              {/* Site */}
              {gameData.website_url && (
                <a href={gameData.website_url} target="_blank" rel="noopener noreferrer" className={styles.websiteLink}>
                  🌐 Site oficial
                </a>
              )}

              {/* Detalhes */}
              <div className={styles.details}>
                <dl className={styles.detailList}>
                  <div className={styles.detailRow}>
                    <dt>Status</dt>
                    <dd>
                      <span className={`${styles.stagePill} ${styles[`stage_${gameData.stage}`]}`}>{STAGES[gameData.stage] ?? gameData.stage}</span>
                    </dd>
                  </div>

                  {gameData.genre && gameData.genre !== "Indefinido" && (
                    <div className={styles.detailRow}>
                      <dt>Gênero</dt>
                      <dd>{gameData.genre}</dd>
                    </div>
                  )}

                  {gameData.engine && (
                    <div className={styles.detailRow}>
                      <dt>Engine</dt>
                      <dd>{gameData.engine}</dd>
                    </div>
                  )}

                  {gameData.release_date && (
                    <div className={styles.detailRow}>
                      <dt>Lançamento</dt>
                      <dd>{new Date(gameData.release_date).toLocaleDateString("pt-BR")}</dd>
                    </div>
                  )}

                  {gameData.platforms?.length > 0 && (
                    <div className={styles.detailRow}>
                      <dt>Plataformas</dt>
                      <dd className={styles.platformsList}>
                        {gameData.platforms.map((p) => (
                          <span key={p} className={styles.platformPill} title={PLATFORM_LABELS[p] ?? p}>
                            {PLATFORM_ICONS[p] ?? "🎮"} {PLATFORM_LABELS[p] ?? p}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Estúdio */}
              {gameData.studio_slug && (
                <div className={styles.studioBox}>
                  <p className={styles.studioLabel}>Desenvolvido por</p>
                  <Link href={`/estudios/${gameData.studio_slug}`} className={styles.studioLink}>
                    {gameData.studio_logo_url && (
                      <Image src={gameData.studio_logo_url} alt={gameData.studio_name} width={32} height={32} className={styles.studioLogo} />
                    )}
                    <span>{gameData.studio_name}</span>
                  </Link>
                </div>
              )}

              {/* Equipe */}
              {gameData.team?.length > 0 && (
                <div className={styles.teamBox}>
                  <p className={styles.teamLabel}>Equipe</p>
                  <ul className={styles.teamList}>
                    {gameData.team.map((member) => (
                      <li key={member.id} className={styles.teamMember}>
                        <Link href={`/perfil/${member.username}`} className={styles.teamMemberLink}>
                          {member.avatar_url ? (
                            <Image src={member.avatar_url} alt={member.username} width={28} height={28} className={styles.teamAvatar} />
                          ) : (
                            <span className={styles.teamAvatarPlaceholder}>{member.username[0].toUpperCase()}</span>
                          )}
                          <div>
                            <span className={styles.teamName}>{member.display_name || member.username}</span>
                            {member.roles && <span className={styles.teamRole}>{member.roles}</span>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editar jogo */}
              {viewer?.canEdit && (
                <Link href={`/estudios/${gameData.studio_slug}/configuracoes`} className={styles.editLink}>
                  Gerenciar jogo
                </Link>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
