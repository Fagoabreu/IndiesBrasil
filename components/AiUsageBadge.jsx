import PropTypes from "prop-types";
import { formatAiLevelBadge, getAiLevel } from "@/lib/ai-usage";
import styles from "./AiUsageBadge.module.css";

/**
 * Selo de uso de IA.
 *
 * Os níveis vêm de `lib/ai-usage.js` — nunca repita o nome aqui: o selo, o
 * modal, os filtros e a página de detalhe precisam dizer a mesma coisa.
 *
 * `level` aceita `null` de propósito e isso **não** é erro: significa "ninguém
 * declarou". O selo mostra `IA N/C` em vez de esconder o estado, porque produto
 * não classificado e produto declarado como "sem IA" são coisas diferentes.
 */
export default function AiUsageBadge({ level, size = "md", className }) {
  const item = getAiLevel(level);
  const toneClass = item ? styles[item.tone] : styles.undeclared;
  const title = item
    ? `Uso de IA — Nível ${item.level}: ${item.name}${item.subtitle ? ` (${item.subtitle})` : ""}`
    : "Uso de IA não informado — o criador ainda não classificou este produto.";

  return (
    <span className={`${styles.badge} ${toneClass} ${styles[size] ?? ""} ${className || ""}`} title={title} aria-label={title}>
      {formatAiLevelBadge(level)}
    </span>
  );
}

AiUsageBadge.propTypes = {
  level: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  size: PropTypes.oneOf(["sm", "md"]),
  className: PropTypes.string,
};
