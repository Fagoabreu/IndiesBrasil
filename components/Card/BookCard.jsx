import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import styles from "./BookCard.module.css";

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
        {book.cover_url ? (
          <Image src={book.cover_url} alt={book.title} width={200} height={300} className={styles.coverImg} unoptimized />
        ) : (
          <div className={styles.coverPlaceholder}>
            <span>{book.title[0]}</span>
          </div>
        )}
        <span className={`${styles.stageBadge} ${stageClass}`}>{stageLabel}</span>
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

        {Number(book.follower_count) > 0 && (
          <div className={styles.cardStats}>
            <span className={styles.stat}>{book.follower_count} seguindo</span>
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
  }).isRequired,
};
