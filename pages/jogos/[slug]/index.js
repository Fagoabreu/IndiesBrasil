"use client";
import { useEffect, useState } from "react";
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
  const [websitePreview, setWebsitePreview] = useState(null); // {url, data} | null
  const displayPreview =
    websitePreview?.url === gameData?.website_url ? websitePreview.data : null;
  const [activeTab, setActiveTab] = useState("overview");
  const [analisesList, setAnalisesList] = useState(null); // {gameId, data} | null
  const displayAnalisesList =
    analisesList?.gameId === gameData?.id ? analisesList.data : null;
  const analisesLoading = displayAnalisesList === null && !!gameData?.id;

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/games/${slug}`, {
          credentials: "include",
        });
        if (!res.ok) {
          router.replace("/jogos");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setGameData(data);
          setFollowing(data.viewer?.isFollowing ?? false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  useEffect(() => {
    if (!gameData?.website_url) return;
    const url = gameData.website_url;
    let cancelled = false;
    fetch(`/api/v1/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setWebsitePreview({ url, data });
      })
      .catch(() => {
        if (!cancelled) setWebsitePreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gameData?.website_url]);

  useEffect(() => {
    if (!gameData?.id) return;
    const gameId = gameData.id;
    let cancelled = false;
    fetch(
      `/api/v1/analises/by-content?content_type=game&content_id=${encodeURIComponent(gameId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setAnalisesList({ gameId, data: Array.isArray(data) ? data : [] });
      })
      .catch(() => {
        if (!cancelled) setAnalisesList({ gameId, data: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [gameData?.id]);

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
        <meta
          name="description"
          content={gameData.short_description || gameData.name}
        />
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
            <GameMediaPlayer
              media={gameData.media || []}
              trailerUrl={gameData.trailer_url}
              bannerUrl={gameData.banner_url}
              name={gameData.name}
            />

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
              {gameData.short_description && (
                <p className={styles.heroTagline}>
                  {gameData.short_description}
                </p>
              )}
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
                    {gameData.release_date
                      ? new Date(gameData.release_date).toLocaleDateString(
                          "pt-BR",
                        )
                      : (STAGES[gameData.stage] ?? gameData.stage)}
                  </dd>
                </div>
              </dl>

              <hr className={styles.heroDivider} />

              {/* Estúdio */}
              {gameData.studio_slug && (
                <Link
                  href={`/estudios/${gameData.studio_slug}`}
                  className={styles.heroStudio}
                >
                  {gameData.studio_logo_url && (
                    <Image
                      src={gameData.studio_logo_url}
                      alt={gameData.studio_name}
                      width={28}
                      height={28}
                      className={styles.heroStudioLogo}
                    />
                  )}
                  <div className={styles.heroStudioInfo}>
                    <span className={styles.heroStudioLabel}>
                      Desenvolvido por
                    </span>
                    <span className={styles.heroStudioName}>
                      {gameData.studio_name}
                    </span>
                  </div>
                </Link>
              )}

              <hr className={styles.heroDivider} />

              {/* Status */}
              <div className={styles.heroDetails}>
                <div className={styles.heroDetailRow}>
                  <span className={styles.heroDetailLabel}>Status</span>
                  <span
                    className={`${styles.stagePill} ${styles[`stage_${gameData.stage}`]}`}
                  >
                    {STAGES[gameData.stage] ?? gameData.stage}
                  </span>
                </div>
                {gameData.genre && gameData.genre !== "Indefinido" && (
                  <div className={styles.heroDetailRow}>
                    <span className={styles.heroDetailLabel}>Gênero</span>
                    <span className={styles.heroDetailValue}>
                      {gameData.genre}
                    </span>
                  </div>
                )}
                {gameData.engine && (
                  <div className={styles.heroDetailRow}>
                    <span className={styles.heroDetailLabel}>Engine</span>
                    <span className={styles.heroDetailValue}>
                      {gameData.engine}
                    </span>
                  </div>
                )}
                {gameData.release_date && (
                  <div className={styles.heroDetailRow}>
                    <span className={styles.heroDetailLabel}>Lançamento</span>
                    <span className={styles.heroDetailValue}>
                      {new Date(gameData.release_date).toLocaleDateString(
                        "pt-BR",
                      )}
                    </span>
                  </div>
                )}
                {gameData.platforms?.length > 0 && (
                  <div className={styles.heroDetailRow}>
                    <span className={styles.heroDetailLabel}>Plataformas</span>
                    <div className={styles.platformsList}>
                      {gameData.platforms.map((p) => (
                        <span
                          key={p}
                          className={styles.platformPill}
                          title={PLATFORM_LABELS[p] ?? p}
                        >
                          {PLATFORM_ICONS[p] ?? "🎮"} {PLATFORM_LABELS[p] ?? p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {gameData.tags?.length > 0 && (
                <div className={styles.heroTagsSection}>
                  <p className={styles.heroTagsLabel}>
                    Marcadores populares para este produto:
                  </p>
                  <div className={styles.heroTags}>
                    {gameData.tags.map((t) => (
                      <Link
                        key={t.id}
                        href={`/jogos?search=${encodeURIComponent(t.name)}`}
                        className={styles.heroTag}
                      >
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
            {/* ── Coluna esquerda: conteúdo principal ── */}
            <main className={styles.main}>
              {/* ── Tabs ── */}
              <nav className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  Visão geral
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === "analises" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("analises")}
                >
                  Análises
                  {displayAnalisesList?.length > 0 && (
                    <span className={styles.tabCount}>
                      {displayAnalisesList.length}
                    </span>
                  )}
                </button>
              </nav>

              {activeTab === "overview" && (
                <>
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

                  {/* Lojas */}
                  {gameData.store_pages?.length > 0 && (
                    <section className={styles.section}>
                      <h2 className={styles.sectionTitle}>Onde comprar</h2>
                      <div className={styles.storeLinks}>
                        {gameData.store_pages.map((sp) => {
                          const steamMatch = sp.page_url?.match(
                            /store\.steampowered\.com\/app\/(\d+)/,
                          );
                          const steamAppId = steamMatch ? steamMatch[1] : null;
                          return (
                            <div key={sp.id} className={styles.storeCard}>
                              <div className={styles.storeCardHeader}>
                                <span className={styles.storeName}>
                                  {sp.store_name}
                                </span>
                                {sp.price != null && (
                                  <span
                                    className={`${styles.storePrice} ${Number(sp.price) === 0 ? styles.storePriceFree : ""}`}
                                  >
                                    {Number(sp.price) === 0
                                      ? "Grátis"
                                      : `R$ ${Number(sp.price).toFixed(2)}`}
                                  </span>
                                )}
                              </div>
                              {steamAppId ? (
                                <iframe
                                  src={`https://store.steampowered.com/widget/${steamAppId}/`}
                                  width="100%"
                                  height="190"
                                  frameBorder="0"
                                  scrolling="no"
                                  title={`${sp.store_name} Widget`}
                                  className={styles.storeSteamWidget}
                                />
                              ) : (
                                <a
                                  href={sp.page_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.storeSimpleLink}
                                >
                                  Visitar loja ↗
                                </a>
                              )}
                            </div>
                          );
                        })}
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
                    onReviewChange={async () => {
                      const res = await fetch(`/api/v1/games/${slug}`, {
                        credentials: "include",
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setGameData(data);
                        setFollowing(data.viewer?.isFollowing ?? false);
                      }
                    }}
                  />
                </>
              )}

              {activeTab === "analises" && (
                <>
                  {analisesLoading ? (
                    <div className={styles.analisesLoading}>
                      <div className={styles.spinner} />
                    </div>
                  ) : displayAnalisesList?.length === 0 ? (
                    <div className={styles.analisesEmpty}>
                      <p>Nenhuma análise publicada para este jogo ainda.</p>
                      <Link
                        href={`/analises/novo?tipo=game&content_id=${gameData.id}`}
                        className={styles.analisesEmptyLink}
                      >
                        📝 Seja o primeiro a publicar uma análise
                      </Link>
                    </div>
                  ) : (
                    <div className={styles.analisesGrid}>
                      {displayAnalisesList?.map((a) => (
                        <Link
                          key={a.id}
                          href={`/analises/${a.slug}`}
                          className={styles.analiseCard}
                        >
                          <div className={styles.analiseCardCover}>
                            {a.cover_url ? (
                              <Image
                                src={a.cover_url}
                                alt={a.title}
                                fill
                                sizes="280px"
                                className={styles.analiseCardCoverImg}
                                unoptimized={
                                  a.cover_url.startsWith("data:") ||
                                  a.cover_url.startsWith("blob:")
                                }
                              />
                            ) : (
                              <div
                                className={styles.analiseCardCoverPlaceholder}
                              >
                                <span>📝</span>
                              </div>
                            )}
                          </div>
                          <div className={styles.analiseCardBody}>
                            <h3 className={styles.analiseCardTitle}>
                              {a.title}
                            </h3>
                            {a.rating && (
                              <div className={styles.analiseCardStars}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <span
                                    key={s}
                                    className={
                                      a.rating >= s
                                        ? styles.starFilled
                                        : styles.starEmpty
                                    }
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className={styles.analiseCardMeta}>
                              {a.author_avatar_url ? (
                                <Image
                                  src={a.author_avatar_url}
                                  alt={a.author_username}
                                  width={16}
                                  height={16}
                                  className={styles.analiseCardAvatar}
                                  unoptimized={
                                    a.author_avatar_url.startsWith("data:") ||
                                    a.author_avatar_url.startsWith("blob:")
                                  }
                                />
                              ) : (
                                <span
                                  className={
                                    styles.analiseCardAvatarPlaceholder
                                  }
                                >
                                  👤
                                </span>
                              )}
                              <span>Por {a.author_username}</span>
                              <span>
                                {new Date(a.published_at).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
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
                  {gameData.follower_count} seguidor
                  {gameData.follower_count !== 1 ? "es" : ""}
                </p>
              )}

              {/* Editar jogo */}
              {viewer?.canEdit && (
                <Link
                  href={`/estudios/${gameData.studio_slug}/configuracoes`}
                  className={styles.editLink}
                >
                  ⚙️ Gerenciar jogo
                </Link>
              )}

              {/* Criar Análise */}
              <Link
                href={`/analises/novo?tipo=game&content_id=${gameData.id}`}
                className={styles.btnAnalise}
              >
                📝 Criar Análise
              </Link>

              {/* Site */}
              {gameData.website_url && (
                <a
                  href={gameData.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.websitePanel}
                >
                  {displayPreview?.image ? (
                    <div className={styles.websitePanelImgWrap}>
                      <Image
                        src={displayPreview.image}
                        alt={displayPreview.title || "Site oficial"}
                        fill
                        sizes="400px"
                        className={styles.websitePanelImg}
                        unoptimized
                      />
                      <span className={styles.websitePanelBadge}>
                        🌐 Site oficial
                      </span>
                    </div>
                  ) : (
                    <div className={styles.websitePanelFallback}>
                      <span className={styles.websitePanelIcon}>🌐</span>
                      <span className={styles.websitePanelLabel}>
                        Site oficial
                      </span>
                    </div>
                  )}
                  {(displayPreview?.title || displayPreview?.description) && (
                    <div className={styles.websitePanelContent}>
                      {displayPreview.title && (
                        <strong className={styles.websitePanelTitle}>
                          {displayPreview.title}
                        </strong>
                      )}
                      {displayPreview.description && (
                        <p className={styles.websitePanelDesc}>
                          {displayPreview.description}
                        </p>
                      )}
                    </div>
                  )}
                </a>
              )}

              {/* Equipe */}
              {gameData.team?.length > 0 && (
                <div className={styles.teamBox}>
                  <p className={styles.teamLabel}>Equipe</p>
                  <ul className={styles.teamList}>
                    {gameData.team.map((member) => (
                      <li key={member.id} className={styles.teamMember}>
                        <Link
                          href={`/perfil/${member.username}`}
                          className={styles.teamMemberLink}
                        >
                          {member.avatar_url ? (
                            <Image
                              src={member.avatar_url}
                              alt={member.username}
                              width={28}
                              height={28}
                              className={styles.teamAvatar}
                            />
                          ) : (
                            <span className={styles.teamAvatarPlaceholder}>
                              {member.username[0].toUpperCase()}
                            </span>
                          )}
                          <div>
                            <span className={styles.teamName}>
                              {member.display_name || member.username}
                            </span>
                            {member.roles && (
                              <span className={styles.teamRole}>
                                {member.roles}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
