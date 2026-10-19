import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import styles from "./AssetCard.module.css";
import AssetCategoryChips from "@/components/Asset/AssetCategoryChips";

/**
 * Card de asset.
 *
 * A capa é opcional (o arquivo do asset não é hospedado aqui), então o
 * placeholder é o estado normal de quem só referenciou um pacote externo.
 */
export default function AssetCard({ asset }) {
  return (
    <Link href={`/assets/${asset.slug}`} className={styles.card}>
      <div className={styles.cardCover}>
        <div className={styles.coverInner}>
          {asset.cover_url ? (
            <Image src={asset.cover_url} alt={asset.name} fill sizes="(max-width: 600px) 100vw, 280px" className={styles.coverImg} />
          ) : (
            <div className={styles.coverPlaceholder}>
              <span>{asset.name?.[0]?.toUpperCase() ?? "?"}</span>
            </div>
          )}
        </div>
        <span className={`${styles.priceBadge} ${asset.is_free ? styles.freeBadge : styles.paidBadge}`}>{asset.is_free ? "Gratuito" : "Pago"}</span>
      </div>

      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{asset.name}</h2>
        {asset.short_description && <p className={styles.cardDesc}>{asset.short_description}</p>}

        <AssetCategoryChips categories={asset.categories} limit={3} as="span" className={styles.chips} />

        {asset.studio_name && (
          <div className={styles.cardMeta}>
            <span className={styles.studioLabel} title={asset.studio_name}>
              {asset.studio_name}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

AssetCard.propTypes = {
  asset: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    short_description: PropTypes.string,
    cover_url: PropTypes.string,
    is_free: PropTypes.bool,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    studio_name: PropTypes.string,
    categories: PropTypes.array,
  }).isRequired,
};
