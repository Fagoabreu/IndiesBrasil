import { useEffect, useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
// CSS compartilhado com o `EmbedComponent`: os dois desenham o mesmo card, e
// duplicar o módulo faria os estilos divergirem no primeiro ajuste.
import styles from "./EmbedComponent.module.css";

/**
 * Normalize old absolute proxy URLs to relative — avoids CSP violations when
 * the site is served from a different domain than the one baked into legacy embeds.
 */
function normalizeImageSrc(src) {
  if (!src) return src;
  // Already relative — nothing to do
  if (src.startsWith("/")) return src;
  try {
    const u = new URL(src);
    // /api/v1/image-proxy paths are always relative-safe
    if (u.pathname.startsWith("/api/")) return u.pathname + u.search;
  } catch {
    // Malformed URL — leave as-is
  }
  return src;
}

/**
 * Card de preview de link externo (og:title/description/image).
 *
 * Os dados vêm gravados no embed, resolvidos quando o post foi criado. Só que
 * o embed pode ter sido salvo **sem** título e imagem — foi o que aconteceu com
 * links do próprio site, que o servidor não conseguia buscar (ver
 * `internalFetchUrl` em `infra/embededResolver.js`). Nesses casos o card
 * aparecia reduzido a "jogos.social.br / jogos.social.br".
 *
 * Por isso, quando falta título, o card se rebusca no cliente e se completa.
 * Vale também para link cujo site estava fora do ar na hora da publicação.
 */
export default function LinkPreviewCard({ embed }) {
  const [enriched, setEnriched] = useState(null);

  useEffect(() => {
    if (embed.title || !embed.url) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/v1/link-preview?url=${encodeURIComponent(embed.url)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data) setEnriched(data);
      } catch {
        // Sem preview: o card segue com o que já está gravado no embed.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embed.title, embed.url]);

  const data = enriched ? { ...embed, ...enriched } : embed;

  const domain = (() => {
    try {
      return new URL(data.url).hostname.replace(/^www\./, "");
    } catch {
      return data.url;
    }
  })();

  // Detecta links de press kit (ex.: /presskit) para exibir o selo de imprensa.
  const isPressKit = (() => {
    try {
      return /\/presskit(?:\/|$)/.test(new URL(data.url).pathname);
    } catch {
      return false;
    }
  })();

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer" className={styles.previewCard}>
      {data.image && (
        <div className={styles.previewImageWrapper}>
          <Image
            src={normalizeImageSrc(data.image)}
            alt={data.title || domain}
            fill
            className={styles.previewImage}
            sizes="(max-width: 400px) 100vw, 600px"
            unoptimized
          />
        </div>
      )}

      <div className={styles.previewContent}>
        <div className={styles.previewSiteRow}>
          {data.icon ? (
            <span className={styles.previewIconWrap}>
              <Image src={normalizeImageSrc(data.icon)} alt="" width={16} height={16} className={styles.previewIcon} unoptimized />
            </span>
          ) : (
            <span className={styles.previewIconFallback}>{(domain.charAt(0) || "w").toUpperCase()}</span>
          )}
          <span className={styles.previewSiteName}>{data.site_name || domain}</span>
          {isPressKit && (
            <span className={styles.previewBadge}>
              <span aria-hidden="true">📰</span> Press Kit
            </span>
          )}
        </div>
        <strong className={styles.previewTitle}>{data.title || domain}</strong>
        {data.description && <p className={styles.previewDesc}>{data.description}</p>}
      </div>
    </a>
  );
}

LinkPreviewCard.propTypes = {
  embed: PropTypes.shape({
    url: PropTypes.string.isRequired,
    image: PropTypes.string,
    icon: PropTypes.string,
    site_name: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
};
