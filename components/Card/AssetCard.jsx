import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";

import cardStyles from "./cardBase.module.css";
import styles from "./AssetCard.module.css";
import AssetCategoryChips from "@/components/Asset/AssetCategoryChips";
import AiUsageBadge from "@/components/AiUsageBadge";

/**
 * Card de asset.
 *
 * A capa é opcional (o arquivo do asset não é hospedado aqui), então o
 * placeholder é o estado normal de quem só referenciou um pacote externo.
 */
export default function AssetCard({ asset }) {
  return (
    <Link href={`/assets/${asset.slug}`} className={`${cardStyles.card} ${cardStyles.interactive} ${cardStyles.row}`}>
      {/* A capa fica limpa: o preço era um overlay no canto onde a arte costuma
          ter o logo e desceu para o rodapé, junto do selo de uso de IA. */}
      <div className={`${cardStyles.cover} ${styles.cardCover}`}>
        <div className={cardStyles.coverInner}>
          {asset.cover_url ? (
            <Image src={asset.cover_url} alt={asset.name} fill sizes="(max-width: 600px) 38vw, 280px" className={cardStyles.coverImg} />
          ) : (
            <div className={cardStyles.coverPlaceholder}>
              <span>{asset.name?.[0]?.toUpperCase() ?? "?"}</span>
            </div>
          )}
        </div>
      </div>

      <div className={cardStyles.body}>
        <h2 className={cardStyles.title}>{asset.name}</h2>
        {asset.short_description && <p className={cardStyles.desc}>{asset.short_description}</p>}

        <div className={cardStyles.footer}>
          <div className={cardStyles.footerFlags}>
            <span className={`${cardStyles.chip} ${asset.is_free ? styles.freeChip : styles.paidChip}`}>{asset.is_free ? "Gratuito" : "Pago"}</span>
            <AiUsageBadge level={asset.ai_level} size="sm" />
          </div>
        </div>

        <div className={cardStyles.meta}>
          {asset.studio_name && (
            <span className={cardStyles.studioLabel} title={asset.studio_name}>
              {asset.studio_name}
            </span>
          )}
          <AssetCategoryChips categories={asset.categories} limit={3} as="span" />
        </div>
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
    ai_level: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    categories: PropTypes.array,
  }).isRequired,
};
