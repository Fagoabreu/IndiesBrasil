import Link from "next/link";
import PropTypes from "prop-types";
import { LANDING_COMMUNITY_STATS, parseSummaryCount } from "@/lib/landing";
import styles from "./CommunityStats.module.css";

/**
 * Prova social em uma linha: "128 jogos · 39 estúdios · 1.240 membros · 6 eventos".
 *
 * A faixa só aparece com número em mãos (`state === "ready"`). Não há
 * placeholder, travessão nem esqueleto: um contador que nunca chega, ou que
 * chega como "—", é pior do que contador nenhum — o visitante lê ausência de
 * dado como ausência de conteúdo. Como o bloco é renderizado no cliente (o
 * `summary` vem por `fetch`), ele entra depois da hidratação e não desloca o
 * conteúdo acima.
 */
export default function CommunityStats({ stats = LANDING_COMMUNITY_STATS, summary = null, state = "loading" }) {
  if (state !== "ready" || !summary) return null;

  const visible = stats.map((stat) => ({ ...stat, count: parseSummaryCount(summary[stat.metric]) })).filter((stat) => stat.count !== null);

  if (visible.length === 0) return null;

  return (
    <ul className={styles.band} aria-label="Números da comunidade">
      {visible.map((stat) => {
        const word = stat.count === 1 ? stat.singular : stat.plural;

        return (
          <li key={stat.metric} className={styles.item}>
            <Link href={stat.href} className={styles.link}>
              <strong className={styles.value}>{stat.count.toLocaleString("pt-BR")}</strong> {word}
              {stat.suffix ? ` ${stat.suffix}` : ""}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

CommunityStats.propTypes = {
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      metric: PropTypes.string.isRequired,
      singular: PropTypes.string,
      plural: PropTypes.string,
      suffix: PropTypes.string,
      href: PropTypes.string.isRequired,
    }),
  ),
  summary: PropTypes.object,
  state: PropTypes.oneOf(["loading", "ready", "error"]),
};
