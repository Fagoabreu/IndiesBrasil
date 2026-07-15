import styles from "./MonetizationBadge.module.css";

const BASE_CLASS = "mzBadge";

/**
 * Selo de transparência de monetização — Lei Felca (PL 412/2022).
 *
 * Exibe selos indicativos quando o jogo contém lootboxes pagas,
 * compras dentro do jogo ou anúncios excessivos.
 *
 * Props:
 *   hasLootboxes        — boolean
 *   hasInGamePurchases  — boolean
 *   hasExcessiveAds     — boolean
 *   size                — "sm" (cards) | "md" (default, detail pages)
 */
export default function MonetizationBadge({ hasLootboxes = false, hasInGamePurchases = false, hasExcessiveAds = false, size = "md" }) {
  const flags = [];

  if (hasLootboxes) {
    flags.push({
      key: "lootboxes",
      icon: (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M3 2.5a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 5 0v.006c0 .07 0 .27-.045.494a2.6 2.6 0 0 1-.228.648c-.26.521-.64.876-1.007 1.093A2.5 2.5 0 0 1 8 6.5a2.5 2.5 0 0 1-3.72-1.759c-.045-.225-.045-.425-.045-.494V2.5zm1 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z" />
          <path d="M2.05 6.06A2.5 2.5 0 0 1 4 5h8a2.5 2.5 0 0 1 1.95 1.06l1.5 2A2.5 2.5 0 0 1 16 9.5v2a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 11.5v-2a2.5 2.5 0 0 1 .55-1.44l1.5-2zM4 6a1.5 1.5 0 0 0-1.17.64l-1.5 2A1.5 1.5 0 0 0 1 9.5v2A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-2a1.5 1.5 0 0 0-.33-.86l-1.5-2A1.5 1.5 0 0 0 12 6H4z" />
        </svg>
      ),
      label: "Lootboxes",
      title: "Este jogo contém lootboxes (caixas de recompensa aleatória pagas) — Lei Felca PL 412/2022",
    });
  }

  if (hasInGamePurchases) {
    flags.push({
      key: "purchases",
      icon: (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M0 2.5A.5.5 0 0 1 .5 2H2a.5.5 0 0 1 .485.379L2.89 4H14.5a.5.5 0 0 1 .485.621l-1.5 6A.5.5 0 0 1 13 11H4a.5.5 0 0 1-.485-.379L1.61 3H.5a.5.5 0 0 1-.5-.5zM3.14 5l1.25 5h8.22l1.25-5H3.14zM5 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm9-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0z" />
        </svg>
      ),
      label: "Compras",
      title: "Este jogo contém compras dentro do jogo (microtransações) — Lei Felca PL 412/2022",
    });
  }

  if (hasExcessiveAds) {
    flags.push({
      key: "ads",
      icon: (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M6 1a.5.5 0 0 1 .5.5v1.795a3.5 3.5 0 0 1 3 0V1.5A.5.5 0 0 1 10 1.5v2.022a3 3 0 0 1 2 2.828v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 2-2.828V1.5A.5.5 0 0 1 6 1zm-.5 2.4a2 2 0 0 0-2 1.95V8h3V3.4H5.5zm.5 5.1v3a2 2 0 0 0 2 1.95V8.5H6zm3 0v4.95A2 2 0 0 0 11 11.5v-3a2 2 0 0 0-2-1.95V8.5zm-8 .5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zm14 0a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5z" />
        </svg>
      ),
      label: "Anúncios",
      title: "Este jogo contém publicidade excessiva — Lei Felca PL 412/2022",
    });
  }

  if (flags.length === 0) {
    return null;
  }

  return (
    <span className={`${BASE_CLASS} ${BASE_CLASS}--${size}`} aria-label="Selos de transparência de monetização — Lei Felca">
      {flags.map((flag) => (
        <span key={flag.key} className={`${styles.badge} ${styles[flag.key]}`} title={flag.title}>
          {flag.icon}
          {size !== "sm" && <span className={styles.label}>{flag.label}</span>}
        </span>
      ))}
    </span>
  );
}
