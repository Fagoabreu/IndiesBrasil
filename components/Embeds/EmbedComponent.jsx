import Image from "next/image";
import styles from "./EmbedComponent.module.css";
import InstagramEmbed from "./InstagramEmbed";
import PropTypes from "prop-types";

/** Normalize old absolute proxy URLs to relative — avoids CSP violations when
 *  the site is served from a different domain than the one baked into legacy embeds. */
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

EmbedComponent.propTypes = {
  embeds: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      type: PropTypes.oneOf(["youtube", "twitch", "instagram", "preview", "steam"]).isRequired,

      embedUrl: PropTypes.string,
      url: PropTypes.string,
      image: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
    }),
  ).isRequired,
};

export default function EmbedComponent({ embeds }) {
  if (!embeds?.length) return null;
  return (
    <div>
      {embeds.map((embed, i) => {
        if (!embed) return null;
        const key = embed.id ?? i;
        if (embed.type === "youtube") {
          return <iframe key={key} title={embed.title} src={embed.embedUrl} height="400" width="100%" allowFullScreen />;
        }

        if (embed.type === "twitch") {
          return (
            <iframe
              key={key}
              src={embed.embedUrl}
              height="400"
              width="100%"
              frameBorder="0"
              allowFullScreen
              scrolling="no"
              allow="fullscreen"
              title={embed.title}
            />
          );
        }

        if (embed.type === "instagram") {
          return (
            <div key={key} className={styles.embed}>
              <InstagramEmbed url={embed.url} />
            </div>
          );
        }

        if (embed.type === "steam") {
          const widgetUrl = embed.appId ? `https://store.steampowered.com/widget/${embed.appId}/` : null;
          if (!widgetUrl) {
            return (
              <a key={key} href={embed.url} target="_blank" rel="noopener noreferrer" className={styles.steamCard}>
                <div className={styles.steamCardBody}>
                  <span className={styles.steamCardTitle}>{embed.title || "Steam"}</span>
                  <span className={styles.steamCardCta}>Abrir na Steam</span>
                </div>
              </a>
            );
          }
          return (
            <iframe
              key={key}
              src={widgetUrl}
              className={styles.steamWidget}
              title={embed.title || "Steam"}
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
              loading="lazy"
            />
          );
        }

        if (embed.type === "preview") {
          // Extract a human-readable domain for fallback title
          const domain = (() => {
            try {
              return new URL(embed.url).hostname.replace(/^www\./, "");
            } catch {
              return embed.url;
            }
          })();

          return (
            <a key={key} href={embed.url} target="_blank" rel="noopener noreferrer" className={styles.previewCard}>
              {embed.image && (
                <div className={styles.previewImageWrapper}>
                  <Image
                    src={normalizeImageSrc(embed.image)}
                    alt={embed.title || "Preview do link"}
                    fill
                    className={styles.previewImage}
                    sizes="(max-width: 400px) 100vw, 600px"
                    unoptimized
                  />
                </div>
              )}

              <div className={styles.previewContent}>
                <strong>{embed.title || domain}</strong>
                {embed.description && <p>{embed.description}</p>}
              </div>
            </a>
          );
        }

        return null;
      })}
    </div>
  );
}
