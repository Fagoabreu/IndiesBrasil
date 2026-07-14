import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftIcon,
  LinkExternalIcon,
  CheckIcon,
  XIcon,
  TrashIcon,
  PencilIcon,
} from "@primer/octicons-react";
import { Spinner } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./NewsDetail.module.css";

export default function NewsDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loadingUser } = useUser();

  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  // Rating
  const [userRating, setUserRating] = useState(null);
  const [sendingRating, setSendingRating] = useState(false);

  // Factcheck
  const [userFactcheck, setUserFactcheck] = useState(null);
  const [sendingFactcheck, setSendingFactcheck] = useState(false);

  // Comentários
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Edição
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || loadingUser) return;

    (async () => {
      setLoading(true);
      setNotFound(false);
      setError(null);
      try {
        const res = await fetch(`/api/v1/news/${id}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError("Erro ao carregar a notícia.");
          return;
        }
        const data = await res.json();
        setNews(data);
        setUserRating(data.user_rating);
        setUserFactcheck(data.user_factcheck);

        // Carregar comentários
        const commentsRes = await fetch(`/api/v1/news/${id}/comments`, {
          credentials: "include",
        });
        if (commentsRes.ok) {
          setComments(await commentsRes.json());
        }
      } catch {
        setError("Erro de conexão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loadingUser]);

  // ─── Rating ───────────────────────────────────
  const handleRating = async (rating) => {
    if (!user || sendingRating || rating === userRating) return;
    setSendingRating(true);
    try {
      await fetch(`/api/v1/news/${id}/ratings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      setUserRating(rating);
      // Recarrega para atualizar média
      const res = await fetch(`/api/v1/news/${id}`, { credentials: "include" });
      if (res.ok) setNews(await res.json());
    } finally {
      setSendingRating(false);
    }
  };

  // ─── Factcheck ────────────────────────────────
  const handleFactcheck = async (vote) => {
    if (!user || sendingFactcheck || vote === userFactcheck) return;
    setSendingFactcheck(true);
    try {
      await fetch(`/api/v1/news/${id}/factchecks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      setUserFactcheck(vote);
      const res = await fetch(`/api/v1/news/${id}`, { credentials: "include" });
      if (res.ok) setNews(await res.json());
    } finally {
      setSendingFactcheck(false);
    }
  };

  // ─── Comentário ───────────────────────────────
  const handleComment = async () => {
    if (!user || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/v1/news/${id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [created, ...prev]);
        setCommentText("");
      }
    } finally {
      setSendingComment(false);
    }
  };

  // ─── Editar ───────────────────────────────────
  const startEditing = () => {
    setEditTitle(news.title);
    setEditSummary(news.summary);
    setEditBody(news.body);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editSummary.trim() || !editBody.trim()) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle.trim());
      formData.append("summary", editSummary.trim());
      formData.append("body", editBody.trim());

      const res = await fetch(`/api/v1/news/${id}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const updated = await res.json();
        setNews(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Deletar ──────────────────────────────────
  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir esta notícia?")) return;
    try {
      const res = await fetch(`/api/v1/news/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) router.push("/noticias");
    } catch {
      alert("Erro ao excluir.");
    }
  };

  // ─── Render ───────────────────────────────────
  if (loading || loadingUser) {
    return (
      <div
        className={styles.page}
        style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}
      >
        <Spinner size="large" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2>Notícia não encontrada</h2>
          <Link href="/noticias" className={styles.backLink}>
            <ArrowLeftIcon size={14} /> Voltar para notícias
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2>{error}</h2>
          <Link href="/noticias" className={styles.backLink}>
            <ArrowLeftIcon size={14} /> Voltar para notícias
          </Link>
        </div>
      </div>
    );
  }

  const isAuthor = user && news.author_id === user.id;
  const firstLetter = (news.title || "N")[0].toUpperCase();

  // Status factcheck
  const totalFC = news.factcheck_count + news.fake_count;
  const fakePct =
    totalFC > 0 ? Math.round((news.fake_count / totalFC) * 100) : 0;
  const isFakeNews = totalFC > 0 && fakePct >= 50;

  return (
    <div className={styles.page}>
      <SeoHead
        title={`${news.title} — Indies Brasil`}
        description={
          news.summary?.slice(0, 160) || "Notícia na comunidade Indies Brasil."
        }
        canonical={`${SITE_URL}/noticias/${id}`}
      />

      <Link href="/noticias" className={styles.backLink}>
        <ArrowLeftIcon size={14} /> Voltar para notícias
      </Link>

      {/* Capa */}
      <div className={styles.hero}>
        {news.img_url ? (
          <Image
            src={news.img_url}
            alt={news.title}
            fill
            className={styles.heroImg}
            sizes="(max-width: 812px) calc(100vw - 32px), 780px"
            priority
          />
        ) : (
          <div className={styles.heroPlaceholder}>{firstLetter}</div>
        )}
      </div>

      {/* Conteúdo */}
      <div className={styles.content}>
        <h1 className={styles.title}>{news.title}</h1>

        <div className={styles.meta}>
          <div className={styles.authorInfo}>
            {news.avatar_url ? (
              <Image
                src={news.avatar_url}
                alt={news.author_username}
                width={24}
                height={24}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {news.author_username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <span>{news.author_username}</span>
          </div>
          <span>
            {new Date(news.created_at).toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {news.updated_at !== news.created_at && (
            <span style={{ fontStyle: "italic" }}>
              (editado em{" "}
              {new Date(news.updated_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              )
            </span>
          )}
        </div>

        {editing ? (
          <div className={styles.editForm}>
            <h4>Editar notícia</h4>
            <input
              className={styles.commentInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título"
            />
            <textarea
              className={styles.commentInput}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="Resumo"
              rows={2}
            />
            <textarea
              className={styles.commentInput}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Corpo"
              rows={6}
            />
            <div className={styles.editActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.body}>{news.body}</div>

            {news.source_url && (
              <a
                href={news.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.source}
              >
                <LinkExternalIcon size={14} />
                {news.source_label || "Fonte externa"}
              </a>
            )}
          </>
        )}

        {/* Rating + Factcheck */}
        <div className={styles.actions}>
          <div className={styles.ratingSection}>
            <span className={styles.ratingLabel}>Avaliação</span>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`${styles.starBtn} ${star <= (userRating || 0) ? styles.starActive : ""} ${!user || isAuthor ? styles.starDisabled : ""}`}
                  onClick={() => handleRating(star)}
                  disabled={!user || isAuthor}
                  title={`${star} estrela${star > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className={styles.ratingValue}>
              {Number(news.avg_rating).toFixed(1)} ({news.rating_count}{" "}
              {news.rating_count === 1 ? "voto" : "votos"})
            </span>
          </div>

          <div className={styles.factcheckSection}>
            <span className={styles.factcheckLabel}>Integridade</span>
            <div className={styles.factcheckButtons}>
              <button
                className={`${styles.factcheckBtn} ${userFactcheck === "factcheck" ? styles.factcheckBtnActiveOk : ""}`}
                onClick={() => handleFactcheck("factcheck")}
                disabled={!user || isAuthor}
              >
                <CheckIcon size={12} /> Fact-check
              </button>
              <button
                className={`${styles.factcheckBtn} ${userFactcheck === "fake" ? styles.factcheckBtnActiveFake : ""}`}
                onClick={() => handleFactcheck("fake")}
                disabled={!user || isAuthor}
              >
                <XIcon size={12} /> Fake News
              </button>
            </div>
            <div className={styles.factcheckResult}>
              {isFakeNews ? (
                <span style={{ color: "#cf222e", fontWeight: 600 }}>
                  ⚠️ Possível Fake News
                </span>
              ) : totalFC > 0 ? (
                <span style={{ color: "#1a7f37" }}>
                  ✓ {news.factcheck_count} fact-check
                  {news.factcheck_count !== 1 ? "s" : ""}
                </span>
              ) : (
                <span>Ainda sem verificação</span>
              )}
            </div>
          </div>
        </div>

        {/* Ações do autor */}
        {isAuthor && (
          <div className={styles.authorActions}>
            <button className={styles.editBtn} onClick={startEditing}>
              <PencilIcon size={12} /> Editar
            </button>
            <button className={styles.deleteBtn} onClick={handleDelete}>
              <TrashIcon size={12} /> Excluir
            </button>
          </div>
        )}

        {/* Comentários */}
        <div className={styles.commentsSection}>
          <h3 className={styles.commentsHeading}>
            Comentários ({comments.length})
          </h3>

          {user ? (
            <div className={styles.commentForm}>
              <textarea
                className={styles.commentInput}
                placeholder="Escreva um comentário..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={1}
              />
              <button
                className={styles.commentBtn}
                onClick={handleComment}
                disabled={!commentText.trim() || sendingComment}
              >
                {sendingComment ? "..." : "Comentar"}
              </button>
            </div>
          ) : (
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--fgColor-muted)",
                marginBottom: 16,
              }}
            >
              <Link href="/login" style={{ color: "var(--brand-primary)" }}>
                Faça login
              </Link>{" "}
              para comentar.
            </p>
          )}

          {comments.length === 0 ? (
            <div className={styles.commentEmpty}>
              Nenhum comentário ainda. Seja o primeiro!
            </div>
          ) : (
            <div className={styles.commentList}>
              {comments.map((c) => (
                <div key={c.id} className={styles.commentItem}>
                  <div className={styles.commentAuthor}>
                    {c.author_avatar_url ? (
                      <Image
                        src={c.author_avatar_url}
                        alt={c.author_username}
                        width={18}
                        height={18}
                        className={styles.avatar}
                      />
                    ) : (
                      <div
                        className={styles.avatarPlaceholder}
                        style={{ width: 18, height: 18, fontSize: "0.6rem" }}
                      >
                        {c.author_username?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    {c.author_username}
                    <span className={styles.commentDate}>
                      {new Date(c.created_at).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className={styles.commentContent}>{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
