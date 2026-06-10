import Image from "next/image";
import Link from "next/link";
import styles from "./GameCard.module.css";

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

export default function GameCard({ game }) {
  const stageLabel = STAGES[game.stage] ?? game.stage;

  return (
    <Link href={`/jogos/${game.slug}`} className={styles.card}>
      <div className={styles.cardCover}>
        <div className={styles.coverInner}>
          {game.banner_url || game.cover_url ? (
            <Image src={game.banner_url || game.cover_url} alt={game.name} fill sizes="(max-width: 600px) 100vw, 280px" className={styles.coverImg} />
          ) : (
            <div className={styles.coverPlaceholder}>
              <span>{game.name[0]}</span>
            </div>
          )}
        </div>
        <span className={`${styles.stageBadge} ${styles[`stage_${game.stage}`]}`}>{stageLabel}</span>
      </div>

      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{game.name}</h2>
        {game.short_description && <p className={styles.cardDesc}>{game.short_description}</p>}

        <div className={styles.cardMeta}>
          {game.studio_name && (
            <span className={styles.studioLabel} title={game.studio_name}>
              {game.studio_name}
            </span>
          )}
          {game.genre && game.genre !== "Indefinido" && <span className={styles.genreBadge}>{game.genre}</span>}
        </div>

        {(game.avg_rating > 0 || game.follower_count > 0) && (
          <div className={styles.cardStats}>
            {game.avg_rating > 0 && <span className={styles.rating}>★ {Number(game.avg_rating).toFixed(1)}</span>}
            {game.follower_count > 0 && <span className={styles.followers}>♥ {game.follower_count}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
