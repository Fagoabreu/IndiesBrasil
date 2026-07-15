import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";
import styles from "./BoardGameCard.module.css";
import ContentRatingBadge from "@/components/ContentRatingBadge";

const CATEGORIES = {
  board_game: "Tabuleiro",
  card_game: "Cartas",
  rpg: "RPG de Mesa",
  dice_game: "Dados",
  miniature: "Miniaturas",
  party_game: "Party Game",
};

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  crowdfunding: "Financiamento",
  production: "Produção",
  released: "Lançado",
  cancelled: "Cancelado",
};

function formatPlayerCount(min, max) {
  if (!min) return null;
  if (max && min === max) return `${min} jog.`;
  if (max) return `${min}–${max} jog.`;
  return `${min}+ jog.`;
}

function formatPlayTime(min, max) {
  if (!min) return null;
  if (max && min === max) return `${min} min`;
  if (max) return `${min}–${max} min`;
  return `${min}+ min`;
}

export default function BoardGameCard({ boardgame }) {
  const categoryLabel = CATEGORIES[boardgame.category] ?? boardgame.category;
  const stageLabel = STAGES[boardgame.stage] ?? boardgame.stage;
  const stageClass = styles[`stage_${boardgame.stage}`];

  const playerCount = formatPlayerCount(boardgame.player_count_min, boardgame.player_count_max);
  const playTime = formatPlayTime(boardgame.play_time_min, boardgame.play_time_max);

  return (
    <Link href={`/jogos-de-mesa/${boardgame.slug}`} className={styles.card}>
      <div className={styles.cardCover}>
        {boardgame.banner_url || boardgame.cover_url ? (
          <Image
            src={boardgame.banner_url || boardgame.cover_url}
            alt={boardgame.name}
            fill
            sizes="(max-width: 600px) 100vw, 280px"
            className={styles.coverImg}
          />
        ) : (
          <div className={styles.coverPlaceholder}>
            <span>{boardgame.name[0]}</span>
          </div>
        )}
        <span className={`${styles.stageBadge} ${stageClass}`}>{stageLabel}</span>
        <span className={styles.ratingBadge}>
          <ContentRatingBadge rating={boardgame.content_rating} size="sm" />
        </span>
      </div>

      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{boardgame.name}</h2>
        {boardgame.short_description && <p className={styles.cardDesc}>{boardgame.short_description}</p>}

        <div className={styles.cardMeta}>
          {boardgame.studio_name && (
            <span className={styles.studioLabel} title={boardgame.studio_name}>
              {boardgame.studio_name}
            </span>
          )}
          <span className={styles.categoryBadge}>{categoryLabel}</span>
        </div>

        {(boardgame.avg_rating > 0 || playerCount || playTime || boardgame.follower_count > 0) && (
          <div className={styles.cardStats}>
            {boardgame.avg_rating > 0 && <span className={styles.rating}>★ {Number(boardgame.avg_rating).toFixed(1)}</span>}
            {playerCount && <span className={styles.stat}>👥 {playerCount}</span>}
            {playTime && <span className={styles.stat}>⏱ {playTime}</span>}
            {boardgame.follower_count > 0 && <span className={styles.stat}>♥ {boardgame.follower_count}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

BoardGameCard.propTypes = {
  boardgame: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    short_description: PropTypes.string,
    category: PropTypes.string,
    stage: PropTypes.string,
    banner_url: PropTypes.string,
    cover_url: PropTypes.string,
    studio_name: PropTypes.string,
    follower_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    avg_rating: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    player_count_min: PropTypes.number,
    player_count_max: PropTypes.number,
    play_time_min: PropTypes.number,
    play_time_max: PropTypes.number,
  }).isRequired,
};
