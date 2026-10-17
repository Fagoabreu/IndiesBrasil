import PropTypes from "prop-types";
import styles from "./LiveBadge.module.css";

/**
 * Selo "AO VIVO".
 *
 * Um só, usado pelo card da listagem e pela página de assistir: antes o vermelho
 * e as medidas viviam no CSS Module da listagem e a segunda tela repetiria a
 * regra — a cor do live já está em `--live-color`, no bloco `:root` do CSS global
 * (`css/`).
 *
 * O posicionamento NÃO vem daqui: na listagem ele flutua sobre a miniatura e na
 * página de assistir fica na linha de título. Cada tela posiciona com a própria
 * classe e este componente desenha apenas o selo.
 */
export default function LiveBadge({ label = "AO VIVO", size = "small" }) {
  return <span className={`${styles.badge} ${size === "large" ? styles.badgeLarge : ""}`}>{label}</span>;
}

LiveBadge.propTypes = {
  label: PropTypes.string,
  size: PropTypes.oneOf(["small", "large"]),
};
