import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import GameReviews from "@/components/GameReviews/GameReviews";
import styles from "./book.module.css";

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

function getFollowLabel(loading, following) {
  if (loading) return "…";
  return following ? "✓ Seguindo" : "+ Seguir";
}

export default function BookPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [bookData, setBookData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchBook = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/books/${slug}`, { credentials: "include" });
      if (!res.ok) {
        router.replace("/quadrinhos");
        return;
      }
      const data = await res.json();
      setBookData(data);
      setFollowing(data.viewer?.isFollowing ?? false);
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  async function handleFollow() {
    if (!user) {
      router.push("/login");
      return;
    }
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/books/${slug}/follow`, {
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

  if (!bookData) return null;

  const typeLabel = BOOK_TYPES[bookData.book_type] ?? bookData.book_type;
  const stageLabel = STAGES[bookData.stage] ?? bookData.stage;

  return (
    <>
      <Head>
        <title>{bookData.title} — Indies Brasil</title>
        <meta name="description" content={bookData.short_description || bookData.title} />
      </Head>

      <div className={styles.page}>
        <div className={styles.content}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <Link href="/quadrinhos">Quadrinhos e Livros</Link>
            <span> / </span>
            <span>{bookData.title}</span>
          </nav>

          {/* Hero */}
          <div className={styles.bookHero}>
            {/* Cover portrait */}
            <div className={styles.heroCoverWrap}>
              {bookData.cover_url ? (
                <Image src={bookData.cover_url} alt={bookData.title} width={220} height={330} className={styles.heroCoverImg} unoptimized />
              ) : (
                <div className={styles.coverPlaceholder}>
                  <span>{bookData.title[0]}</span>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className={styles.heroInfo}>
              <h1 className={styles.heroTitle}>{bookData.title}</h1>
              {bookData.subtitle && <p className={styles.heroSubtitle}>{bookData.subtitle}</p>}
              {bookData.short_description && <p className={styles.heroTagline}>{bookData.short_description}</p>}

              <hr className={styles.heroDivider} />

              <dl className={styles.heroMeta}>
                <div className={styles.heroMetaRow}>
                  <dt className={styles.heroMetaLabel}>Tipo</dt>
                  <dd className={styles.heroMetaValue}>{typeLabel}</dd>
                </div>
                <div className={styles.heroMetaRow}>
                  <dt className={styles.heroMetaLabel}>Fase</dt>
                  <dd className={styles.heroMetaValue}>{stageLabel}</dd>
                </div>
                {bookData.publisher && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Editora</dt>
                    <dd className={styles.heroMetaValue}>{bookData.publisher}</dd>
                  </div>
                )}
                {bookData.pages && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Páginas</dt>
                    <dd className={styles.heroMetaValue}>{bookData.pages}</dd>
                  </div>
                )}
                {bookData.isbn && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>ISBN</dt>
                    <dd className={styles.heroMetaValue}>{bookData.isbn}</dd>
                  </div>
                )}
                {bookData.language && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Idioma</dt>
                    <dd className={styles.heroMetaValue}>{bookData.language}</dd>
                  </div>
                )}
                {bookData.release_date && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Lançamento</dt>
                    <dd className={styles.heroMetaValue}>
                      {new Date(bookData.release_date).toLocaleDateString("pt-BR", { year: "numeric", month: "long" })}
                    </dd>
                  </div>
                )}
                {bookData.studio_name && (
                  <div className={styles.heroMetaRow}>
                    <dt className={styles.heroMetaLabel}>Estúdio</dt>
                    <dd className={styles.heroMetaValue}>
                      {bookData.studio_slug ? (
                        <Link href={`/estudios/${bookData.studio_slug}`} className={styles.heroMetaLink}>
                          {bookData.studio_name}
                        </Link>
                      ) : (
                        bookData.studio_name
                      )}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Actions */}
              <div className={styles.heroActions}>
                <button type="button" className={following ? styles.btnUnfollow : styles.btnFollow} onClick={handleFollow} disabled={followLoading}>
                  {getFollowLabel(followLoading, following)}
                </button>

                {bookData.buy_url && (
                  <a href={bookData.buy_url} target="_blank" rel="noopener noreferrer" className={styles.btnBuy}>
                    Onde comprar
                  </a>
                )}

                {bookData.website_url && (
                  <a href={bookData.website_url} target="_blank" rel="noopener noreferrer" className={styles.btnWebsite}>
                    Site oficial
                  </a>
                )}

                {bookData.viewer?.canEdit && (
                  <Link href={`/estudios/${bookData.studio_slug}/configuracoes`} className={styles.btnEdit}>
                    Editar
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {bookData.description && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Sobre a publicação</h2>
              <div className={styles.description}>
                {bookData.description.split("\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          {/* Avaliações */}
          <GameReviews
            reviewsApiUrl={`/api/v1/books/${slug}/reviews`}
            avgRating={bookData.avg_rating}
            reviewCount={Number(bookData.review_count ?? 0)}
            userReview={bookData.viewer?.userReview ?? null}
            user={user}
            onReviewChange={fetchBook}
          />

          {/* PDF */}
          {bookData.pdf_url && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>PDF</h2>
              <div className={styles.pdfCard}>
                <a href={bookData.pdf_url} target="_blank" rel="noopener noreferrer" className={styles.pdfLink}>
                  <span className={styles.pdfIcon}>📄</span>
                  <span className={styles.pdfLabel}>Ler / Baixar PDF</span>
                  <span className={styles.pdfArrow}>→</span>
                </a>
              </div>
            </section>
          )}

          {/* Stores */}
          {Array.isArray(bookData.store_pages) && bookData.store_pages.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Onde comprar</h2>
              <ul className={styles.storeList}>
                {bookData.store_pages.map((sp) => (
                  <li key={sp.id} className={styles.storeItem}>
                    <a href={sp.page_url} target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
                      <span className={styles.storeName}>{sp.store_name || `Loja #${sp.store_type_id}`}</span>
                      {sp.price != null && (
                        <span className={styles.storePrice}>{Number(sp.price) === 0 ? "Grátis" : `R$ ${Number(sp.price).toFixed(2)}`}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
