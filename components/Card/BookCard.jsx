import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";

import cardStyles from "./cardBase.module.css";
import styles from "./BookCard.module.css";
import ContentRatingBadge from "@/components/ContentRatingBadge";
import AiUsageBadge from "@/components/AiUsageBadge";

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

  return (
    <Link href={`/quadrinhos/${book.slug}`} className={`${cardStyles.card} ${cardStyles.interactive} ${cardStyles.row}`}>
      {/* A capa fica limpa: nenhum selo cobre a arte. */}
      <div className={`${cardStyles.cover} ${styles.cardCover}`}>
        <div className={cardStyles.coverInner}>
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              width={200}
              height={300}
              className={`${cardStyles.coverImg} ${styles.coverImg}`}
              unoptimized
            />
          ) : (
            <div className={cardStyles.coverPlaceholder}>
              <span>{book.title[0]}</span>
            </div>
          )}
        </div>
      </div>

      <div className={cardStyles.body}>
        <h2 className={cardStyles.title}>{book.title}</h2>
        {book.short_description && <p className={cardStyles.desc}>{book.short_description}</p>}

        <div className={cardStyles.footer}>
          <div className={cardStyles.footerStats}>
            {book.avg_rating > 0 && <span className={cardStyles.rating}>★ {Number(book.avg_rating).toFixed(1)}</span>}
            {Number(book.follower_count) > 0 && <span>♥ {book.follower_count}</span>}
          </div>

          {/* Fase, classificação e uso de IA ao lado da nota — nunca sobre a arte. */}
          <div className={cardStyles.footerFlags}>
            {stageLabel && <span className={`${cardStyles.chip} ${styles[`stage_${book.stage}`]}`}>{stageLabel}</span>}
            <ContentRatingBadge rating={book.content_rating} size="sm" inline />
            <AiUsageBadge level={book.ai_level} size="sm" />
          </div>
        </div>

        <div className={cardStyles.meta}>
          {book.studio_name && (
            <span className={cardStyles.studioLabel} title={book.studio_name}>
              {book.studio_name}
            </span>
          )}
          {typeLabel && <span className={`${cardStyles.chip} ${cardStyles.chipNeutral}`}>{typeLabel}</span>}
        </div>
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
