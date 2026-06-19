"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Heading, Spinner, Button } from "@primer/react";
import { BookIcon, StarIcon, StarFillIcon, CheckIcon, ChevronRightIcon, PencilIcon, TrashIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./curso.module.css";

export default function CursoPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user } = useUser();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadCourse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/courses/${slug}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) setError("Curso não encontrado.");
        else setError("Erro ao carregar o curso.");
        return;
      }
      const data = await res.json();
      setCourse(data);
      if (data.viewer?.userRating) setUserRating(data.viewer.userRating);
    } catch {
      setError("Erro ao carregar o curso.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRate(rating) {
    if (!user || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`/api/v1/courses/${slug}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        setUserRating(rating);
        loadCourse();
      }
    } catch {
      // silently fail
    } finally {
      setRatingSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja remover este curso?")) return;
    try {
      await fetch(`/api/v1/courses/${slug}`, { method: "DELETE", credentials: "include" });
      router.push("/estudos");
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="medium" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className={styles.errorState}>
        <Heading as="h2">Curso não encontrado</Heading>
        <p>{error || "Este curso não existe ou foi removido."}</p>
        <Link href="/estudos" className={styles.btnPrimary}>
          Voltar para cursos
        </Link>
      </div>
    );
  }

  const isOwner = course.viewer?.isOwner;
  const progress = course.viewer?.progress;
  const completedCount = progress?.completedCount ?? 0;
  const totalCount = progress?.totalCount ?? course.lessons?.length ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={styles.page}>
      <SeoHead
        title={`${course.title} — Indies Brasil`}
        description={course.description?.slice(0, 160) || `Curso: ${course.title}`}
        canonical={`${SITE_URL}/estudos/${course.slug}`}
        openGraph={{
          title: `${course.title} — Indies Brasil`,
          description: course.description?.slice(0, 160) || "",
          url: `${SITE_URL}/estudos/${course.slug}`,
        }}
      />

      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/estudos">Cursos</Link>
        <ChevronRightIcon size={14} />
        <span>{course.title}</span>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        {course.cover_url ? (
          <div className={styles.coverWrapper}>
            <Image
              src={course.cover_url}
              alt=""
              fill
              className={styles.coverImg}
              sizes="(max-width: 768px) 100vw, 800px"
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div className={styles.coverPlaceholder}>
            <BookIcon size={48} />
          </div>
        )}
        <div className={styles.heroContent}>
          <Heading as="h1" className={styles.courseTitle}>
            {course.title}
          </Heading>
          {course.description && <p className={styles.courseDesc}>{course.description}</p>}

          <div className={styles.heroMeta}>
            <span className={styles.metaAuthor}>
              por <strong>{course.owner_username}</strong>
            </span>
            <span className={styles.metaBullet}>·</span>
            <span className={styles.metaLessons}>
              {totalCount} {totalCount === 1 ? "aula" : "aulas"}
            </span>

            {/* Rating display */}
            <span className={styles.metaBullet}>·</span>
            <span className={styles.starsDisplay}>
              {[1, 2, 3, 4, 5].map((star) =>
                star <= Math.round(Number(course.avg_rating)) ? (
                  <StarFillIcon key={star} size={14} className={styles.starFilled} />
                ) : (
                  <StarIcon key={star} size={14} className={styles.starEmpty} />
                ),
              )}
              <span className={styles.ratingText}>
                {Number(course.avg_rating).toFixed(1)} ({course.rating_count ?? 0})
              </span>
            </span>
          </div>

          {/* Tags */}
          {course.tags?.length > 0 && (
            <div className={styles.tagRow}>
              {course.tags.map((t) => (
                <span key={t.id} className={styles.tag}>
                  {t.name}
                </span>
              ))}
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div className={styles.ownerActions}>
              <Link href={`/estudos/${course.slug}/editar`} className={styles.btnOutline}>
                <PencilIcon size={14} /> Editar
              </Link>
              <Button variant="danger" onClick={handleDelete}>
                <TrashIcon size={14} /> Remover
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Rating for users */}
      {user && !isOwner && (
        <div className={styles.rateSection}>
          <span className={styles.rateLabel}>Sua avaliação:</span>
          <div className={styles.starsInteractive}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={styles.starBtn}
                disabled={ratingSubmitting}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleRate(star)}
                aria-label={`Avaliar ${star} estrela${star > 1 ? "s" : ""}`}
              >
                {(hoverRating || userRating) >= star ? <StarFillIcon size={22} className={styles.starActive} /> : <StarIcon size={22} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar (for logged in users) */}
      {user && totalCount > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>
              Seu progresso: {completedCount}/{totalCount} aulas ({progressPercent}%)
            </span>
            {progress?.nextLessonOrder !== null && progress?.nextLessonOrder !== undefined && (
              <Link href={`/estudos/${course.slug}/aulas/${progress.nextLessonOrder}`} className={styles.btnPrimary}>
                Continuar <ChevronRightIcon size={14} />
              </Link>
            )}
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Lesson List */}
      <section className={styles.lessonsSection}>
        <div className={styles.lessonsHeader}>
          <Heading as="h2">Aulas</Heading>
        </div>

        {course.lessons?.length === 0 && <p className={styles.noLessons}>Este curso ainda não possui aulas.</p>}

        <ul className={styles.lessonList}>
          {course.lessons?.map((lesson) => {
            const isCompleted = progress?.lessons?.find((p) => p.lesson_id === lesson.id)?.completed;
            return (
              <li key={lesson.id} className={`${styles.lessonItem} ${isCompleted ? styles.lessonCompleted : ""}`}>
                <Link href={`/estudos/${course.slug}/aulas/${lesson.order_index}`} className={styles.lessonLink}>
                  <div className={styles.lessonIcon}>
                    {isCompleted ? (
                      <CheckIcon size={16} className={styles.checkIcon} />
                    ) : (
                      <span className={styles.lessonNum}>{lesson.order_index + 1}</span>
                    )}
                  </div>
                  <div className={styles.lessonInfo}>
                    <span className={styles.lessonTitle}>{lesson.title}</span>
                    {lesson.description && <span className={styles.lessonDesc}>{lesson.description}</span>}
                    <span className={styles.lessonMeta}>
                      {lesson.video_url && "🎬 Vídeo "}
                      {lesson.reading_material && "📖 Leitura "}
                    </span>
                  </div>
                  <ChevronRightIcon size={16} className={styles.lessonArrow} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Continue CTA */}
      {user && !isOwner && progress?.nextLessonOrder !== null && progress?.nextLessonOrder !== undefined && (
        <div className={styles.bottomCta}>
          <Link href={`/estudos/${course.slug}/aulas/${progress.nextLessonOrder}`} className={styles.btnPrimary}>
            Continuar curso <ChevronRightIcon size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
