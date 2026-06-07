import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";
import styles from "./GameReviews.module.css";

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
          onClick={() => !readOnly && onChange?.(star)}
          disabled={readOnly}
          aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

StarRating.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool,
};

export default function GameReviews({ reviewsApiUrl, avgRating, reviewCount, userReview, user, onReviewChange }) {
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(userReview?.rating ?? 0);
  const [reviewContent, setReviewContent] = useState(userReview?.content ?? "");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState({ type: null, text: "" });
  const [editingReview, setEditingReview] = useState(false);

  const fetchReviews = useCallback(async () => {
    const res = await fetch(reviewsApiUrl, { credentials: "include" });
    if (res.ok) setReviews(await res.json());
  }, [reviewsApiUrl]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (userReview) {
      setReviewRating(userReview.rating ?? 0);
      setReviewContent(userReview.content ?? "");
    }
  }, [userReview]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reviewRating) {
      setReviewMsg({ type: "error", text: "Selecione uma nota de 1 a 5 estrelas." });
      return;
    }
    setReviewMsg({ type: null, text: "" });
    setReviewSubmitting(true);
    try {
      const isEdit = !!userReview && editingReview;
      const res = await fetch(reviewsApiUrl, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          isEdit ? { reviewId: userReview.id, rating: reviewRating, content: reviewContent } : { rating: reviewRating, content: reviewContent },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewMsg({ type: "error", text: data.message || "Erro ao salvar avaliação." });
        return;
      }
      setReviewMsg({ type: "success", text: "Avaliação salva!" });
      setEditingReview(false);
      onReviewChange?.();
      await fetchReviews();
    } finally {
      setReviewSubmitting(false);
    }
  }

  const hasUserReview = !!userReview;
  const count = Number(reviewCount ?? 0);

  return (
    <section className={styles.section} id="reviews">
      <h2 className={styles.sectionTitle}>
        Avaliações
        {count > 0 && <span className={styles.reviewCount}> ({count})</span>}
      </h2>

      {avgRating > 0 && (
        <div className={styles.avgRating}>
          <span className={styles.avgScore}>{Number(avgRating).toFixed(1)}</span>
          <StarRating value={Math.round(avgRating)} readOnly />
          <span className={styles.avgLabel}>
            {count} avaliação{count === 1 ? "" : "ões"}
          </span>
        </div>
      )}

      {user ? (
        <div className={styles.reviewFormWrap}>
          {hasUserReview && !editingReview ? (
            <div className={styles.userReviewBox}>
              <p className={styles.reviewFormTitle}>Sua avaliação</p>
              <StarRating value={userReview.rating} readOnly />
              {userReview.content && <p className={styles.userReviewContent}>{userReview.content}</p>}
              <button type="button" className={styles.btnEditReview} onClick={() => setEditingReview(true)}>
                Editar avaliação
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.reviewForm}>
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
                <p className={`${styles.reviewMsg} ${reviewMsg.type === "error" ? styles.msgError : styles.msgSuccess}`}>{reviewMsg.text}</p>
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
  );
}

GameReviews.propTypes = {
  reviewsApiUrl: PropTypes.string.isRequired,
  avgRating: PropTypes.number,
  reviewCount: PropTypes.number,
  userReview: PropTypes.shape({
    id: PropTypes.number.isRequired,
    rating: PropTypes.number.isRequired,
    content: PropTypes.string,
  }),
  user: PropTypes.object,
  onReviewChange: PropTypes.func,
};
