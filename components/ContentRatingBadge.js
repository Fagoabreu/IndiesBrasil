import { RATING_LABELS, RATING_COLORS } from "@/lib/rating-constants";

const BASE_CLASS = "crBadge";

/**
 * Luminância relativa (WCAG) de um `#rrggbb`.
 *
 * Necessária porque a paleta do ClassInd não é uniforme: `#f7c600` (10 anos) é
 * amarelo e `#1a1a2e` (18) é quase preto. Texto branco fixo dava 1.9:1 no
 * amarelo — ilegível — e o selo do "18" virava um quadrado preto sobre o card
 * escuro. Escolher o texto pela luminância resolve os dois de uma vez, sem
 * mexer na tabela (ela também alimenta a arte de Open Graph, onde o hex é o
 * valor final).
 */
function isLightColor(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return false;

  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35;
}

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
 *   inline   — dentro do corpo do card (sem a borda branca de recorte)
 */
export default function ContentRatingBadge({ rating, size = "md", reasons, className, inline = false }) {
  if (!rating) {
    return (
      <span
        className={`${BASE_CLASS} ${BASE_CLASS}--unrated ${BASE_CLASS}--${size} ${className || ""}`}
        title="Não classificado"
        style={{ ...styles.unrated, ...(inline ? styles.inlineUnrated : {}) }}
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
        ...(inline ? styles.inline : {}),
        backgroundColor: color,
        color: isLightColor(color) ? "#1f2328" : "#ffffff",
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
  /*
   * No corpo do card o selo não está sobre uma foto: a borda branca existia
   * para recortar o selo da arte e, fora dela, só engorda a caixa e cria um
   * segundo anel no "N/C".
   */
  inline: {
    border: "1px solid var(--borderColor-muted)",
  },
  /*
   * O "N/C" tem cor própria; a borda inline precisa ser declarada também aqui,
   * senão ele mantém a borda cinza-clara de recorte sobre o card.
   */
  inlineUnrated: {
    border: "1px solid var(--borderColor-muted)",
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
  /*
   * `color-mix` sobre `transparent` em vez de `--bgColor-muted`: no tema escuro
   * o card já é `--bgColor-muted`, então o "N/C" perdia o preenchimento e
   * sobrava só a borda. Assim ele compõe sobre qualquer superfície.
   */
  unrated: {
    backgroundColor: "color-mix(in srgb, var(--fgColor-muted) 14%, transparent)",
    color: "var(--fgColor-muted, #666)",
    fontWeight: 600,
    border: "1.5px solid var(--borderColor-muted)",
  },
};
