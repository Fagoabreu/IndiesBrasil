"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import styles from "./analise.module.css";

const CONTENT_TYPE_LABELS = {
  game: "Jogo",
  boardgame: "Jogo de Mesa",
  book: "Livro/Quadrinho",
};

function getContentUrl(contentType, slug) {
  const prefix = { game: "/jogos", boardgame: "/jogos-de-mesa", book: "/quadrinhos" };
  return `${prefix[contentType] || ""}/${slug}`;
}

function StarRating({ value }) {
  if (!value) return null;
  return (
    <span className={styles.stars} aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={value >= s ? styles.starFilled : styles.starEmpty}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function AnalisePage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalise = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/analises/${slug}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          router.replace("/analises");
          return;
        }
        throw new Error("Erro ao carregar análise");
      }
      setAnalise(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchAnalise();
  }, [fetchAnalise]);

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja excluir esta análise?")) return;
    try {
      const res = await fetch(`/api/v1/analises/${slug}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/analises");
      }
    } catch {
      // ignore
    }
  }

  if (loadingUser || loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error || !analise) return null;

  const isAuthor = user?.id === analise.author_id;
  const sections = analise.sections || [];

  return (
    <>
      <Head>
        <title>{analise.title} — Análises — Indies Brasil</title>
        <meta name="description" content={analise.title} />
        <meta property="og:title" content={analise.title} />
        <meta property="og:type" content="article" />
        {analise.cover_url && <meta property="og:image" content={analise.cover_url} />}
      </Head>

      <article className={styles.page}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link href="/analises">Análises</Link>
          {analise.content_type && (
            <>
              <span> / </span>
              <Link href={`/analises?content_type=${analise.content_type}`}>{CONTENT_TYPE_LABELS[analise.content_type] || analise.content_type}</Link>
            </>
          )}
        </nav>

        {/* Content reference card */}
        {analise.content_name && (
          <div className={styles.contentRefCard}>
            <div className={styles.contentRefThumb}>
              {analise.content_cover_url ? (
                <Image
                  src={analise.content_cover_url}
                  alt={analise.content_name}
                  fill
                  sizes="80px"
                  className={styles.contentRefThumbImg}
                  unoptimized={analise.content_cover_url.startsWith("data:") || analise.content_cover_url.startsWith("blob:")}
                />
              ) : (
                <span className={styles.contentRefThumbPlaceholder}>📦</span>
              )}
            </div>
            <div className={styles.contentRefInfo}>
              <span className={styles.contentRefLabel}>Esta análise é sobre</span>
              {analise.content_slug ? (
                <Link href={getContentUrl(analise.content_type, analise.content_slug)} className={styles.contentRefName}>
                  {analise.content_name}
                </Link>
              ) : (
                <span className={styles.contentRefName}>{analise.content_name}</span>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <header className={styles.articleHeader}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerMain}>
              <span className={styles.badge}>{CONTENT_TYPE_LABELS[analise.content_type] || analise.content_type}</span>
              <h1 className={styles.articleTitle}>{analise.title}</h1>
            </div>

            {analise.rating && (
              <div className={styles.ratingBadge}>
                <div>
                  <span className={styles.ratingLabel}>Nota</span>
                  <span className={styles.ratingValue}>{analise.rating}</span>
                </div>
                <StarRating value={analise.rating} />
              </div>
            )}
          </div>

          <div className={styles.articleMeta}>
            <div className={styles.authorInfo}>
              {analise.author_avatar_url && (
                <Image
                  src={analise.author_avatar_url}
                  alt={analise.author_username}
                  width={36}
                  height={36}
                  className={styles.authorAvatar}
                  unoptimized={analise.author_avatar_url.startsWith("data:") || analise.author_avatar_url.startsWith("blob:")}
                />
              )}
              <div className={styles.authorText}>
                <span className={styles.authorName}>Por {analise.author_username}</span>
                <span className={styles.publishDate}>
                  {new Date(analise.published_at).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Author actions */}
        {isAuthor && (
          <div className={styles.authorActions}>
            <Link href={`/analises/novo?edit=${analise.slug}`} className={styles.btnEdit}>
              ✏️ Editar análise
            </Link>
            <button type="button" onClick={handleDelete} className={styles.btnDelete}>
              🗑️ Excluir
            </button>
          </div>
        )}

        {/* Cover hero */}
        {analise.cover_url && (
          <div className={styles.coverHero}>
            <Image
              src={analise.cover_url}
              alt={analise.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 860px"
              className={styles.coverHeroImg}
              unoptimized={analise.cover_url.startsWith("data:") || analise.cover_url.startsWith("blob:")}
            />
          </div>
        )}

        {/* Sections */}
        <div className={styles.sections}>
          {sections.map((section, i) => (
            <SectionRenderer key={i} section={section} index={i} />
          ))}
        </div>

        {/* Points */}
        {(analise.positive_points?.length > 0 || analise.negative_points?.length > 0) && (
          <div className={styles.pointsGrid}>
            {analise.positive_points?.length > 0 && (
              <div className={styles.pointsBox}>
                <h2 className={styles.pointsTitle}>✅ Pontos Positivos</h2>
                <ul className={styles.pointsList}>
                  {analise.positive_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {analise.negative_points?.length > 0 && (
              <div className={styles.pointsBox}>
                <h2 className={styles.pointsTitle}>❌ Pontos Negativos</h2>
                <ul className={styles.pointsList}>
                  {analise.negative_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Author footer */}
        <footer className={styles.authorFooter}>
          <div className={styles.authorFooterInner}>
            {analise.author_avatar_url && (
              <Image src={analise.author_avatar_url} alt={analise.author_username} width={64} height={64} className={styles.authorFooterAvatar} />
            )}
            <div>
              <p className={styles.authorFooterName}>{analise.author_username}</p>
              {analise.author_bio && <p className={styles.authorFooterBio}>{analise.author_bio}</p>}
            </div>
          </div>
        </footer>
      </article>
    </>
  );
}

function SectionRenderer({ section, index }) {
  if (section.type === "text") {
    return (
      <section className={styles.textSection}>
        {section.subtitle && <h2 className={styles.sectionSubtitle}>{section.subtitle}</h2>}
        <div
          className={styles.sectionContent}
          dangerouslySetInnerHTML={{ __html: section.content }}
          // Conteúdo sanitizado pelo autor no momento da criação via textarea/editor
        />
      </section>
    );
  }

  if (section.type === "image") {
    return (
      <section className={styles.imageSection}>
        {section.subtitle && <h2 className={styles.sectionSubtitle}>{section.subtitle}</h2>}
        <div className={styles.sectionImageWrap}>
          <Image
            src={section.image_url || `/api/v1/uploaded-images/${section.image_id}/url`}
            alt={section.subtitle || `Imagem ${index + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className={styles.sectionImage}
          />
        </div>
      </section>
    );
  }

  if (section.type === "video") {
    return (
      <section className={styles.videoSection}>
        {section.subtitle && <h2 className={styles.sectionSubtitle}>{section.subtitle}</h2>}
        <div className={styles.videoWrapper}>
          <iframe src={section.embed_url} title={section.subtitle || `Vídeo ${index + 1}`} allowFullScreen className={styles.videoIframe} />
        </div>
      </section>
    );
  }

  return null;
}
