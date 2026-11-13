import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";

import cardStyles from "./cardBase.module.css";
import styles from "./BoardGameCard.module.css";
import ContentRatingBadge from "@/components/ContentRatingBadge";
import AiUsageBadge from "@/components/AiUsageBadge";

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

  const playerCount = formatPlayerCount(boardgame.player_count_min, boardgame.player_count_max);
  const playTime = formatPlayTime(boardgame.play_time_min, boardgame.play_time_max);

  return (
    <Link href={`/jogos-de-mesa/${boardgame.slug}`} className={`${cardStyles.card} ${cardStyles.interactive} ${cardStyles.row}`}>
      {/* A capa fica limpa: nenhum selo cobre a arte. */}
      <div className={`${cardStyles.cover} ${styles.cardCover}`}>
        {boardgame.banner_url || boardgame.cover_url ? (
          <Image
            src={boardgame.banner_url || boardgame.cover_url}
            alt={boardgame.name}
            fill
            sizes="(max-width: 600px) 38vw, 280px"
            className={cardStyles.coverImg}
          />
        ) : (
          <div className={cardStyles.coverPlaceholder}>
            <span>{boardgame.name[0]}</span>
          </div>
        )}
      </div>

      <div className={cardStyles.body}>
        <h2 className={cardStyles.title}>{boardgame.name}</h2>
        {boardgame.short_description && <p className={cardStyles.desc}>{boardgame.short_description}</p>}

        <div className={cardStyles.footer}>
          <div className={cardStyles.footerStats}>
            {boardgame.avg_rating > 0 && <span className={cardStyles.rating}>★ {Number(boardgame.avg_rating).toFixed(1)}</span>}
            {playerCount && <span>👥 {playerCount}</span>}
            {playTime && <span>⏱ {playTime}</span>}
            {boardgame.follower_count > 0 && <span>♥ {boardgame.follower_count}</span>}
          </div>

          {/* Fase, classificação e uso de IA ao lado da nota — nunca sobre a arte. */}
          <div className={cardStyles.footerFlags}>
            {stageLabel && <span className={`${cardStyles.chip} ${styles[`stage_${boardgame.stage}`]}`}>{stageLabel}</span>}
            <ContentRatingBadge rating={boardgame.content_rating} size="sm" inline />
            <AiUsageBadge level={boardgame.ai_level} size="sm" />
          </div>
        </div>

        <div className={cardStyles.meta}>
          {boardgame.studio_name && (
            <span className={cardStyles.studioLabel} title={boardgame.studio_name}>
              {boardgame.studio_name}
            </span>
          )}
          {categoryLabel && <span className={`${cardStyles.chip} ${cardStyles.chipNeutral}`}>{categoryLabel}</span>}
        </div>
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
    content_rating: PropTypes.string,
    ai_level: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    follower_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    avg_rating: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    player_count_min: PropTypes.number,
    player_count_max: PropTypes.number,
    play_time_min: PropTypes.number,
    play_time_max: PropTypes.number,
  }).isRequired,
};
