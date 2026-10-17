import PropTypes from "prop-types";
import { getPlatform } from "@/lib/streams";
import styles from "./PlatformBadge.module.css";

/**
 * Selo da plataforma (Twitch, YouTube e, no futuro, Kick/plataforma própria).
 *
 * O rótulo vem do registro (`lib/streams.js`) e a cor daqui — antes a listagem
 * tinha `styles.platform_twitch`/`styles.platform_youtube` no próprio CSS Module
 * e a página de assistir copiaria as duas regras. Com o mapa explícito abaixo,
 * uma plataforma nova ganha cor nas duas telas de uma vez (e o
 * `scripts/audit-css-modules.js` continua enxergando as classes, o que um
 * `styles["platform_" + id]` esconderia).
 */
const STYLE_BY_PLATFORM = {
  twitch: styles.platform_twitch,
  youtube: styles.platform_youtube,
};

export default function PlatformBadge({ platform, size = "small" }) {
  const meta = getPlatform(platform);
  if (!meta) return null;

  const sizeClass = size === "large" ? styles.badgeLarge : "";
  return <span className={`${styles.badge} ${sizeClass} ${STYLE_BY_PLATFORM[meta.id] ?? ""}`}>{meta.label}</span>;
}

PlatformBadge.propTypes = {
  /* Identificador da plataforma (`twitch` | `youtube`), como em `org_stream_status`. */
  platform: PropTypes.string,
  size: PropTypes.oneOf(["small", "large"]),
};
