import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";
import { HIGHLIGHT_TYPE_LABELS, HIGHLIGHT_TYPE_ROUTES, HIGHLIGHT_TYPES } from "@/lib/highlights";
import styles from "./HighlightCard.module.css";

/** Único host de imagem que `next.config.js` deixa otimizar — e o nosso storage. */
const OPTIMIZABLE_HOST = "res.cloudinary.com";

/**
 * A capa de livro pode ser **externa** (`cover_url_external`): o endereço é
 * digitado pela pessoa e o host é qualquer um. O `next/image` recusa host fora
 * de `images.remotePatterns` e, no servidor, esse erro vira **500 na página
 * inteira** — foi assim que a home parou de responder depois que os destaques
 * passaram a ser renderizados no SSR.
 *
 * Mesma decisão de `BookCard` e da capa em `pages/quadrinhos/[slug]`, que já
 * desenham a capa com `unoptimized`: uma imagem que não carrega é um problema,
 * uma home que não abre é outro.
 */
function isOptimizable(src) {
  if (!src) return false;

  try {
    return new URL(src).hostname === OPTIMIZABLE_HOST;
  } catch {
    // URL relativa ou inválida: o otimizador não tem o que buscar.
    return false;
  }
}

export default function HighlightCard({ item }) {
  const { type, name, slug, short_description, banner_url, studio_name, studio_logo_url } = item;
  const routeBase = HIGHLIGHT_TYPE_ROUTES[type] || "/";
  const typeLabel = HIGHLIGHT_TYPE_LABELS[type] || type;

  return (
    <Link href={`${routeBase}/${slug}`} className={styles.card}>
      {/* Banner / cover */}
      <div className={styles.cardBanner}>
        {banner_url ? (
          /* Quatro colunas em tela cheia (ver `.highlightGridGrouped`): um
             `sizes` de 33vw faria o Next baixar imagem maior que o card. */
          <Image
            src={banner_url}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1100px) 50vw, 25vw"
            className={styles.bannerImg}
            unoptimized={!isOptimizable(banner_url)}
          />
        ) : (
          <div className={styles.bannerPlaceholder}>
            <span>{name[0]}</span>
          </div>
        )}
        <span className={styles.typeBadge}>{typeLabel}</span>
      </div>

      {/* Info */}
      <div className={styles.cardBody}>
        <h3 className={styles.cardName}>{name}</h3>
        {short_description && <p className={styles.cardDesc}>{short_description}</p>}

        {studio_name && (
          <div className={styles.studioRow}>
            {studio_logo_url && <Image src={studio_logo_url} alt={studio_name} width={20} height={20} className={styles.studioLogo} />}
            <span className={styles.studioName}>{studio_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

HighlightCard.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.oneOf(HIGHLIGHT_TYPES).isRequired,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    short_description: PropTypes.string,
    banner_url: PropTypes.string,
    studio_name: PropTypes.string,
    studio_slug: PropTypes.string,
    studio_logo_url: PropTypes.string,
  }).isRequired,
};
