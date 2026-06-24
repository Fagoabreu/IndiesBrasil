import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import styles from "./BookCard.module.css";
import ContentRatingBadge from "components/ContentRatingBadge";

export const BOOK_TYPES = {
  book: "Livro",
  comic: "Quadrinho",
  manga: "Mangá",
  graphic_novel: "Romance Gráfico",
  zine: "Zine",
  artbook: "Artbook",
  rpg_manual: "Manual de RPG",
  other: "Outro",
};

export const STAGES = {
  concept: "Conceito",
  writing: "Escrevendo",
  crowdfunding: "Financiamento",
  production: "Produção",
  released: "Publicado",
  cancelled: "Cancelado",
};

export default function BookCard({ book }) {
  const typeLabel = BOOK_TYPES[book.book_type] ?? book.book_type;
  const stageLabel = STAGES[book.stage] ?? book.stage;
  const stageClass = styles[`stage_${book.stage}`];

  return (
    <Link href={`/quadrinhos/${book.slug}`} className={styles.card}>
      <div className={styles.cardCover}>
        <div className={styles.coverInner}>
          {book.cover_url ? (
            <Image src={book.cover_url} alt={book.title} width={200} height={300} className={styles.coverImg} unoptimized />
          ) : (
            <div className={styles.coverPlaceholder}>
              <span>{book.title[0]}</span>
            </div>
          )}
        </div>
        {/* Efeito de páginas (lado direito) — sempre presente */}
        <div className={styles.pagesEffect} />
        <span className={`${styles.stageBadge} ${stageClass}`}>{stageLabel}</span>
        <span className={styles.ratingBadge}>
          <ContentRatingBadge rating={book.content_rating} size="sm" />
        </span>
      </div>

      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{book.title}</h2>
        {book.short_description && <p className={styles.cardDesc}>{book.short_description}</p>}

        <div className={styles.cardMeta}>
          {book.studio_name && (
            <span className={styles.studioLabel} title={book.studio_name}>
              {book.studio_name}
            </span>
          )}
          <span className={styles.typeBadge}>{typeLabel}</span>
        </div>

        {(book.avg_rating > 0 || Number(book.follower_count) > 0) && (
          <div className={styles.cardStats}>
            {book.avg_rating > 0 && <span className={styles.rating}>★ {Number(book.avg_rating).toFixed(1)}</span>}
            {Number(book.follower_count) > 0 && <span className={styles.stat}>{book.follower_count} seguindo</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

BookCard.propTypes = {
  book: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    short_description: PropTypes.string,
    book_type: PropTypes.string,
    stage: PropTypes.string,
    cover_url: PropTypes.string,
    studio_name: PropTypes.string,
    studio_slug: PropTypes.string,
    follower_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    avg_rating: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
};
