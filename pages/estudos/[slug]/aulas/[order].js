"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Heading, Spinner } from "@primer/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  CommentDiscussionIcon,
  PencilIcon,
  TrashIcon,
} from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import { markdownToHtml } from "@/utils/markdown";
import CommentEditor from "@/components/CommentEditor/CommentEditor";
import styles from "./aula.module.css";

export default function AulaPage() {
  const router = useRouter();
  const { slug, order } = router.query;
  const { user } = useUser();

  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Progress
  const [completed, setCompleted] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Edit / Delete comment
  const [editCommentId, setEditCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(null);

  useEffect(() => {
    if (!slug || order === undefined) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, order]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/courses/${slug}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Curso não encontrado.");
        return;
      }
      const courseData = await res.json();
      setCourse(courseData);
      setLessons(courseData.lessons || []);

      // Find current lesson
      const currentLesson = courseData.lessons?.find(
        (l) => l.order_index === Number(order),
      );
      if (!currentLesson) {
        // Fetch lesson directly
        const lessonRes = await fetch(
          `/api/v1/courses/${slug}/lessons/${order}`,
          { credentials: "include" },
        );
        if (!lessonRes.ok) {
          setError("Aula não encontrada.");
          return;
        }
        setLesson(await lessonRes.json());
      } else {
        setLesson(currentLesson);
      }

      // Check if completed
      if (user && courseData.viewer?.progress?.lessons) {
        const prog = courseData.viewer.progress.lessons.find(
          (p) => p.lesson_id === currentLesson?.id,
        );
        setCompleted(!!prog?.completed);
      }

      // Load comments
      loadComments();
    } catch {
      setError("Erro ao carregar a aula.");
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    setCommentsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/courses/${slug}/lessons/${order}/comments`,
        { credentials: "include" },
      );
      if (res.ok) {
        setComments(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setCommentsLoading(false);
    }
  }

  async function toggleCompleted() {
    if (!user || progressLoading) return;
    setProgressLoading(true);
    try {
      await fetch(`/api/v1/courses/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order: Number(order), completed: !completed }),
      });
      setCompleted(!completed);
    } catch {
      // silently fail
    } finally {
      setProgressLoading(false);
    }
  }

  async function handlePostComment() {
    if (!user || !newComment.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/courses/${slug}/lessons/${order}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: newComment.trim() }),
        },
      );
      if (res.ok) {
        setNewComment("");
        loadComments();
      }
    } catch {
      // silently fail
    } finally {
      setCommentSubmitting(false);
    }
  }

  function handleStartEdit(c) {
    setEditCommentId(c.id);
    setEditCommentContent(c.content);
  }

  function handleCancelEdit() {
    setEditCommentId(null);
    setEditCommentContent("");
  }

  async function handleSubmitEdit() {
    if (!editCommentContent.trim() || editSubmitting) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/courses/${slug}/lessons/${order}/comments/${editCommentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: editCommentContent.trim() }),
        },
      );
      if (res.ok) {
        handleCancelEdit();
        loadComments();
      }
    } catch {
      // silently fail
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId) {
    if (
      !window.confirm("Tem certeza que deseja excluir este comentário?") ||
      deleteSubmitting
    )
      return;
    setDeleteSubmitting(commentId);
    try {
      const res = await fetch(
        `/api/v1/courses/${slug}/lessons/${order}/comments/${commentId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (res.ok) {
        loadComments();
      }
    } catch {
      // silently fail
    } finally {
      setDeleteSubmitting(null);
    }
  }

  function handleSpoilerClick(e) {
    // Event delegation para spoilers renderizados via dangerouslySetInnerHTML
    const spoiler = e.target.closest(".spoiler");
    if (!spoiler) return;
    spoiler.classList.toggle("revealed");
    if (e.target.tagName === "A" && !spoiler.classList.contains("revealed")) {
      e.preventDefault();
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="medium" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className={styles.errorState}>
        <Heading as="h2">Aula não encontrada</Heading>
        <p>{error || "Esta aula não existe ou foi removida."}</p>
        <Link href={`/estudos/${slug}`} className={styles.btnPrimary}>
          Voltar ao curso
        </Link>
      </div>
    );
  }

  const currentIdx = lessons.findIndex((l) => l.order_index === Number(order));
  const prevLesson = currentIdx > 0 ? lessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx < lessons.length - 1 ? lessons[currentIdx + 1] : null;
  return (
    <div className={styles.page}>
      <SeoHead
        title={`${lesson.title} — ${course?.title || ""} — Indies Brasil`}
        description={
          lesson.description?.slice(0, 160) || `Aula: ${lesson.title}`
        }
        canonical={`${SITE_URL}/estudos/${slug}/aulas/${order}`}
      />

      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/estudos">Cursos</Link>
        <ChevronRightIcon size={14} />
        <Link href={`/estudos/${slug}`}>{course?.title || "Curso"}</Link>
        <ChevronRightIcon size={14} />
        <span>{lesson.title}</span>
      </nav>

      {/* Lesson Header */}
      <header className={styles.lessonHeader}>
        <div>
          <span className={styles.lessonBadge}>Aula {Number(order) + 1}</span>
          <Heading as="h1" className={styles.lessonTitle}>
            {lesson.title}
          </Heading>
          {lesson.description && (
            <p className={styles.lessonDesc}>{lesson.description}</p>
          )}
        </div>
        {user && (
          <button
            type="button"
            className={`${styles.completeBtn} ${completed ? styles.completedBtn : ""}`}
            onClick={toggleCompleted}
            disabled={progressLoading}
          >
            <CheckIcon size={16} />
            {completed ? "Concluída" : "Marcar como concluída"}
          </button>
        )}
      </header>

      {/* Video Embed */}
      {lesson.video_url && (
        <section className={styles.videoSection}>
          <VideoEmbed url={lesson.video_url} />
        </section>
      )}

      {/* Reading Material */}
      {lesson.reading_material && (
        <section className={styles.readingSection}>
          <Heading as="h2">Material de Leitura</Heading>
          {/* We use dangerouslySetInnerHTML because reading_material may contain formatted text from a rich editor */}
          <div
            className={styles.readingContent}
            dangerouslySetInnerHTML={{ __html: lesson.reading_material }}
          />
        </section>
      )}

      {/* Navigation */}
      <nav className={styles.lessonNav}>
        {prevLesson ? (
          <Link
            href={`/estudos/${slug}/aulas/${prevLesson.order_index}`}
            className={styles.navLink}
          >
            <ChevronLeftIcon size={16} /> {prevLesson.title}
          </Link>
        ) : (
          <span />
        )}
        {nextLesson ? (
          <Link
            href={`/estudos/${slug}/aulas/${nextLesson.order_index}`}
            className={styles.navLink}
          >
            {nextLesson.title} <ChevronRightIcon size={16} />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {/* Forum / Comments */}
      <section className={styles.forumSection}>
        <Heading as="h2" className={styles.forumTitle}>
          <CommentDiscussionIcon size={18} /> Fórum de Dúvidas
        </Heading>

        {user && (
          <div className={styles.commentForm}>
            <CommentEditor
              value={newComment}
              onChange={setNewComment}
              onSubmit={handlePostComment}
              submitting={commentSubmitting}
              placeholder="Tire sua dúvida sobre esta aula..."
            />
          </div>
        )}

        {!user && (
          <p className={styles.loginPrompt}>
            <Link href="/login">Faça login</Link> para participar do fórum.
          </p>
        )}

        {commentsLoading && (
          <div className={styles.commentsLoading}>
            <Spinner size="small" /> Carregando comentários...
          </div>
        )}

        {!commentsLoading && comments.length === 0 && (
          <p className={styles.noComments}>
            Nenhuma dúvida ainda. Seja o primeiro a perguntar!
          </p>
        )}

        <ul className={styles.commentList}>
          {comments.map((c) => (
            <li key={c.id} className={styles.commentItem}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>
                  {c.author_username}
                </span>
                <span className={styles.commentMeta}>
                  <span className={styles.commentDate}>
                    {new Date(c.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {user && c.author_id === user.id && (
                    <span className={styles.commentActions}>
                      <button
                        type="button"
                        className={styles.commentActionBtn}
                        title="Editar"
                        onClick={() => handleStartEdit(c)}
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.commentActionBtn}
                        title="Excluir"
                        disabled={deleteSubmitting === c.id}
                        onClick={() => handleDeleteComment(c.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </span>
                  )}
                </span>
              </div>
              {editCommentId === c.id ? (
                <div className={styles.commentEditForm}>
                  <CommentEditor
                    value={editCommentContent}
                    onChange={setEditCommentContent}
                    onSubmit={handleSubmitEdit}
                    submitting={editSubmitting}
                  />
                  <button
                    type="button"
                    className={styles.commentCancelBtn}
                    onClick={handleCancelEdit}
                    disabled={editSubmitting}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div
                  className={styles.commentContent}
                  onClick={handleSpoilerClick}
                  /* dangerouslySetInnerHTML: comentário markdown convertido
                   * para HTML com sanitização via utils/markdown. */
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(c.content),
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function VideoEmbed({ url }) {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/i,
  );
  if (ytMatch) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
        title="Vídeo da aula"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    );
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeoMatch) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        title="Vídeo da aula"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
      />
    );
  }

  // Fallback: direct iframe
  return (
    <iframe
      src={url}
      title="Vídeo da aula"
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    />
  );
}
