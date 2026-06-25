import { RATING_LABELS, RATING_COLORS } from "@/lib/rating-constants";

const BASE_CLASS = "crBadge";

/**
 * Selo de classificação indicativa brasileiro.
 *
 * Exibe a faixa etária (L, 6, 10, 12, 14, 16, 18) com as cores
 * oficiais do ClassInd adaptadas ao tema do site.
 *
 * Props:
 *   rating   — "L" | "6" | "10" | "12" | "14" | "16" | "18" | null
 *   size     — "sm" (cards) | "md" (default, detail pages)
 *   reasons  — array opcional de motivos (mostrado em tooltip)
 */
export default function ContentRatingBadge({ rating, size = "md", reasons, className }) {
  if (!rating) {
    return (
      <span
        className={`${BASE_CLASS} ${BASE_CLASS}--unrated ${BASE_CLASS}--${size} ${className || ""}`}
        title="Não classificado"
        style={styles.unrated}
      >
        N/C
      </span>
    );
  }

  const label = RATING_LABELS[rating] || rating;
  const color = RATING_COLORS[rating] || "#666";
  const tooltip = reasons?.length
    ? `Classificação ${label}\n\nMotivos:\n${reasons.map((r) => `• ${r}`).join("\n")}`
    : `Classificação Indicativa: ${label}`;

  return (
    <span
      className={`${BASE_CLASS} ${BASE_CLASS}--${size} ${className || ""}`}
      title={tooltip}
      style={{
        ...styles.badge,
        backgroundColor: color,
        ...(size === "sm" ? styles.sm : {}),
      }}
      aria-label={`Classificação Indicativa: ${label}`}
    >
      {rating === "L" ? "L" : rating}
    </span>
  );
}

const styles = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    fontWeight: 700,
    color: "#ffffff",
    lineHeight: 1,
    flexShrink: 0,
    fontFamily: "var(--fontStack-monospace, monospace)",
    border: "1.5px solid #ffffff",
  },
  sm: {
    width: "24px",
    height: "24px",
    fontSize: "13px",
    minWidth: "24px",
  },
  md: {
    width: "32px",
    height: "32px",
    fontSize: "16px",
    minWidth: "32px",
  },
  unrated: {
    backgroundColor: "var(--bgColor-muted, #e5e5e5)",
    color: "var(--fgColor-muted, #666)",
    fontWeight: 600,
    border: "1.5px solid #b0b0b0",
  },
};
