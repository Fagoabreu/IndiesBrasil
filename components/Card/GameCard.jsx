import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";

import cardStyles from "./cardBase.module.css";
import styles from "./GameCard.module.css";
import ContentRatingBadge from "@/components/ContentRatingBadge";
import AiUsageBadge from "@/components/AiUsageBadge";
import MonetizationBadge from "@/components/MonetizationBadge";

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

export default function GameCard({ game, priority = false }) {
  const stageLabel = STAGES[game.stage] ?? game.stage;
  const hasMonetization = game.has_lootboxes || game.has_in_game_purchases || game.has_excessive_ads;

  return (
    <Link href={`/jogos/${game.slug}`} className={`${cardStyles.card} ${cardStyles.interactive} ${cardStyles.row}`}>
      {/* A capa fica limpa: nenhum selo cobre a arte. */}
      <div className={`${cardStyles.cover} ${styles.cardCover}`}>
        <div className={cardStyles.coverInner}>
          {game.banner_url || game.cover_url ? (
            <Image
              src={game.banner_url || game.cover_url}
              alt={game.name}
              fill
              sizes="(max-width: 600px) 38vw, 280px"
              className={cardStyles.coverImg}
              priority={priority}
            />
          ) : (
            <div className={cardStyles.coverPlaceholder}>
              <span>{game.name[0]}</span>
            </div>
          )}
        </div>
      </div>

      <div className={cardStyles.body}>
        <h2 className={cardStyles.title}>{game.name}</h2>
        {/* Slot fixo: o vazio reservado mantém a zona de selos alinhada entre
            os cards da mesma linha do grid. */}
        <p className={cardStyles.desc}>{game.short_description}</p>

        {/*
         * Tags em linha própria, acima dos selos, e como TEXTO.
         *
         * - Não são `.chip`: chip significa ESTADO (fase, classificação, IA) e
         *   esta zona já é a terceira classificação do card; mais uma pílula
         *   competiria com o que importa.
         * - Slot com `min-height` fixo: card sem tag não pode deslocar a zona
         *   de selos dos vizinhos da mesma linha do grid.
         * - Sem `<Link>`: o card inteiro é um `<Link>` e `<a>` dentro de `<a>` é
         *   HTML inválido — o clique na tag existe na ficha, não aqui.
         * - Duas tags no máximo (`+N` indica o resto): em 230px de card, três
         *   cortariam no meio de uma tag.
         */}
        <p className={cardStyles.tags} title={game.tags?.length ? game.tags.map((tag) => `#${tag}`).join(" ") : undefined}>
          {game.tags?.length
            ? `${game.tags
                .slice(0, 2)
                .map((tag) => `#${tag}`)
                .join(" ")}${game.tags.length > 2 ? ` +${game.tags.length - 2}` : ""}`
            : ""}
        </p>

        {/* Zona 3 — estado. Sempre na mesma ordem: fase, classificação, IA. */}
        <div className={cardStyles.badges}>
          {stageLabel && <span className={`${cardStyles.chip} ${styles[`stage_${game.stage}`]}`}>{stageLabel}</span>}
          <ContentRatingBadge rating={game.content_rating} size="sm" inline />
          <AiUsageBadge level={game.ai_level} size="sm" />
          {hasMonetization && (
            <MonetizationBadge
              hasLootboxes={game.has_lootboxes}
              hasInGamePurchases={game.has_in_game_purchases}
              hasExcessiveAds={game.has_excessive_ads}
              size="sm"
            />
          )}
        </div>

        {/* Zona 4 — identidade à esquerda, métricas à direita. */}
        <div className={cardStyles.footer}>
          <span className={cardStyles.identity} title={[game.studio_name, game.genre].filter(Boolean).join(" · ")}>
            {[game.studio_name, game.genre !== "Indefinido" ? game.genre : null].filter(Boolean).join(" · ")}
          </span>
          {(game.avg_rating > 0 || game.follower_count > 0) && (
            <span className={cardStyles.metrics}>
              {game.avg_rating > 0 && <span className={cardStyles.rating}>★ {Number(game.avg_rating).toFixed(1)}</span>}
              {game.follower_count > 0 && <span>♥ {game.follower_count}</span>}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

GameCard.propTypes = {
  game: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    short_description: PropTypes.string,
    stage: PropTypes.string,
    genre: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    banner_url: PropTypes.string,
    cover_url: PropTypes.string,
    studio_name: PropTypes.string,
    content_rating: PropTypes.string,
    ai_level: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    has_lootboxes: PropTypes.bool,
    has_in_game_purchases: PropTypes.bool,
    has_excessive_ads: PropTypes.bool,
    follower_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    avg_rating: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  priority: PropTypes.bool,
};
