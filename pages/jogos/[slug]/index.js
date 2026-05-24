"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
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

function StarRating({ value, onChange, readOnly = false }) {
  const [hovered, setHovered] = useState(0);
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${styles.star} ${(hovered || value) >= star ? styles.starFilled : ""}`}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          onClick={() => !readOnly && onChange && onChange(star)}
          disabled={readOnly}
          aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default function GamePage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [gameData, setGameData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState({ type: null, text: "" });
  const [editingReview, setEditingReview] = useState(false);

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

      // Pre-fill review form if user already reviewed
      if (data.viewer?.userReview) {
        setReviewRating(data.viewer.userReview.rating);
        setReviewContent(data.viewer.userReview.content || "");
      }

      // Set first media as active
      if (data.media?.length > 0) {
        setActiveMedia(data.media[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  const fetchReviews = useCallback(async () => {
    if (!slug) return;
    const res = await fetch(`/api/v1/games/${slug}/reviews`, { credentials: "include" });
    if (res.ok) setReviews(await res.json());
  }, [slug]);

  useEffect(() => {
    fetchGame();
    fetchReviews();
  }, [fetchGame, fetchReviews]);

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

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!reviewRating) {
      setReviewMsg({ type: "error", text: "Selecione uma nota de 1 a 5 estrelas." });
      return;
    }
    setReviewMsg({ type: null, text: "" });
    setReviewSubmitting(true);

    try {
      const hasExisting = !!gameData?.viewer?.userReview;

      if (hasExisting && editingReview) {
        const res = await fetch(`/api/v1/games/${slug}/reviews`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reviewId: gameData.viewer.userReview.id,
            rating: reviewRating,
            content: reviewContent,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setReviewMsg({ type: "error", text: data.message || "Erro ao atualizar avaliação." });
          return;
        }
      } else {
        const res = await fetch(`/api/v1/games/${slug}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ rating: reviewRating, content: reviewContent }),
        });
        const data = await res.json();
        if (!res.ok) {
          setReviewMsg({ type: "error", text: data.message || "Erro ao enviar avaliação." });
          return;
        }
      }

      setReviewMsg({ type: "success", text: "Avaliação salva!" });
      setEditingReview(false);
      fetchGame();
      fetchReviews();
    } finally {
      setReviewSubmitting(false);
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
  const hasUserReview = !!viewer?.userReview;
  const showReviewForm = user && (!hasUserReview || editingReview);

  return (
    <>
      <Head>
        <title>{gameData.name} — Indies Brasil</title>
        <meta name="description" content={gameData.short_description || gameData.name} />
      </Head>

      <div className={styles.page}>
        {/* ── Banner ── */}
        {gameData.banner_url && (
          <div className={styles.bannerWrap}>
            <Image src={gameData.banner_url} alt={`Banner de ${gameData.name}`} fill priority sizes="100vw" className={styles.bannerImg} />
            <div className={styles.bannerOverlay} />
          </div>
        )}

        <div className={styles.content}>
          {/* ── Breadcrumb ── */}
          <nav className={styles.breadcrumb}>
            <Link href="/jogos">Jogos</Link>
            <span> / </span>
            <span>{gameData.name}</span>
          </nav>

          {/* ── Layout principal ── */}
          <div className={styles.layout}>
            {/* ── Coluna esquerda: mídia ── */}
            <main className={styles.main}>
              {/* Título + tagline mobile */}
              <div className={styles.titleBlockMobile}>
                <h1 className={styles.gameName}>{gameData.name}</h1>
                {gameData.short_description && <p className={styles.tagline}>{gameData.short_description}</p>}
              </div>

              {/* Galeria de mídia */}
              {gameData.media?.length > 0 && (
                <section className={styles.mediaSection}>
                  <div className={styles.mediaMain}>
                    {activeMedia?.media_type === "video" ? (
                      <div className={styles.videoWrap}>
                        <iframe
                          src={toEmbedUrl(activeMedia.url)}
                          title={activeMedia.caption || "Trailer"}
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          className={styles.videoFrame}
                        />
                      </div>
                    ) : activeMedia ? (
                      <Image
                        src={activeMedia.url}
                        alt={activeMedia.caption || gameData.name}
                        fill
                        sizes="(max-width: 900px) 100vw, 640px"
                        className={styles.mediaMainImg}
                      />
                    ) : null}
                  </div>

                  <div className={styles.mediaThumbs}>
                    {gameData.media.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`${styles.thumb} ${activeMedia?.id === m.id ? styles.thumbActive : ""}`}
                        onClick={() => setActiveMedia(m)}
                      >
                        {m.media_type === "video" ? (
                          <span className={styles.thumbVideo}>▶</span>
                        ) : (
                          <Image src={m.url} alt={m.caption || ""} fill sizes="120px" className={styles.thumbImg} />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

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
              <section className={styles.section} id="reviews">
                <h2 className={styles.sectionTitle}>
                  Avaliações
                  {gameData.review_count > 0 && <span className={styles.reviewCount}> ({gameData.review_count})</span>}
                </h2>

                {gameData.avg_rating > 0 && (
                  <div className={styles.avgRating}>
                    <span className={styles.avgScore}>{Number(gameData.avg_rating).toFixed(1)}</span>
                    <StarRating value={Math.round(gameData.avg_rating)} readOnly />
                    <span className={styles.avgLabel}>
                      {gameData.review_count} avaliação{gameData.review_count !== 1 ? "ões" : ""}
                    </span>
                  </div>
                )}

                {/* Formulário de avaliação */}
                {user ? (
                  <div className={styles.reviewFormWrap}>
                    {hasUserReview && !editingReview ? (
                      <div className={styles.userReviewBox}>
                        <p className={styles.reviewFormTitle}>Sua avaliação</p>
                        <StarRating value={viewer.userReview.rating} readOnly />
                        {viewer.userReview.content && <p className={styles.userReviewContent}>{viewer.userReview.content}</p>}
                        <button type="button" className={styles.btnEdit} onClick={() => setEditingReview(true)}>
                          Editar avaliação
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitReview} className={styles.reviewForm}>
                        <p className={styles.reviewFormTitle}>{hasUserReview ? "Editar avaliação" : "Avaliar este jogo"}</p>
                        <StarRating value={reviewRating} onChange={setReviewRating} />
                        <textarea
                          className={styles.reviewTextarea}
                          placeholder="Compartilhe sua experiência (opcional)"
                          value={reviewContent}
                          onChange={(e) => setReviewContent(e.target.value)}
                          rows={3}
                          maxLength={1000}
                        />
                        {reviewMsg.text && (
                          <p className={`${styles.reviewMsg} ${reviewMsg.type === "error" ? styles.msgError : styles.msgSuccess}`}>
                            {reviewMsg.text}
                          </p>
                        )}
                        <div className={styles.reviewFormActions}>
                          {hasUserReview && (
                            <button type="button" className={styles.btnCancel} onClick={() => setEditingReview(false)}>
                              Cancelar
                            </button>
                          )}
                          <button type="submit" className={styles.btnSubmit} disabled={reviewSubmitting || !reviewRating}>
                            {reviewSubmitting ? "Salvando..." : "Salvar avaliação"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className={styles.loginHint}>
                    <Link href="/login" className={styles.loginLink}>
                      Faça login
                    </Link>{" "}
                    para avaliar este jogo.
                  </p>
                )}

                {/* Lista de reviews */}
                {reviews.length > 0 && (
                  <ul className={styles.reviewList}>
                    {reviews.map((r) => (
                      <li key={r.id} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <Link href={`/perfil/${r.username}`} className={styles.reviewAuthor}>
                            {r.avatar_url ? (
                              <Image src={r.avatar_url} alt={r.username} width={28} height={28} className={styles.reviewAvatar} />
                            ) : (
                              <span className={styles.reviewAvatarPlaceholder}>{r.username[0].toUpperCase()}</span>
                            )}
                            <span>{r.display_name || r.username}</span>
                          </Link>
                          <StarRating value={r.rating} readOnly />
                          <time className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</time>
                        </div>
                        {r.content && <p className={styles.reviewContent}>{r.content}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </main>

            {/* ── Coluna direita: sidebar ── */}
            <aside className={styles.sidebar}>
              {/* Cover + título desktop */}
              <div className={styles.sidebarHeader}>
                {gameData.cover_url && (
                  <div className={styles.coverWrap}>
                    <Image src={gameData.cover_url} alt={gameData.name} fill sizes="300px" className={styles.coverImg} />
                  </div>
                )}
                <h1 className={styles.gameNameDesktop}>{gameData.name}</h1>
                {gameData.short_description && <p className={styles.taglineDesktop}>{gameData.short_description}</p>}
              </div>

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

              {/* Trailer */}
              {gameData.trailer_url && (
                <a href={gameData.trailer_url} target="_blank" rel="noopener noreferrer" className={styles.trailerLink}>
                  ▶ Assistir trailer
                </a>
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

              {/* Tags */}
              {gameData.tags?.length > 0 && (
                <div className={styles.tags}>
                  {gameData.tags.map((t) => (
                    <Link key={t.id} href={`/jogos?search=${encodeURIComponent(t.name)}`} className={styles.tag}>
                      {t.name}
                    </Link>
                  ))}
                </div>
              )}

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

function toEmbedUrl(url) {
  if (!url) return url;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return url;
}
