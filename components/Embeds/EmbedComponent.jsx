import styles from "./EmbedComponent.module.css";
import InstagramEmbed from "./InstagramEmbed";
import LinkPreviewCard from "./LinkPreviewCard";
import PropTypes from "prop-types";

EmbedComponent.propTypes = {
  embeds: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      type: PropTypes.oneOf(["youtube", "twitch", "instagram", "preview", "steam"]).isRequired,
      subtype: PropTypes.string,

      embedUrl: PropTypes.string,
      url: PropTypes.string,
      image: PropTypes.string,
      icon: PropTypes.string,
      site_name: PropTypes.string,
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
          // Wrapper 16:9 (ou 9:16 para Shorts): sem ele o iframe ficava quase
          // quadrado no mobile e o player cortava as laterais do vídeo.
          return (
            <div key={key} className={`${styles.videoEmbed}${embed.subtype === "shorts" ? ` ${styles.videoShort}` : ""}`}>
              <iframe
                title={embed.title || (embed.subtype === "shorts" ? "Short do YouTube" : "Vídeo do YouTube")}
                src={embed.embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              />
            </div>
          );
        }

        if (embed.type === "twitch") {
          return (
            <div key={key} className={styles.videoEmbed}>
              <iframe src={embed.embedUrl} allowFullScreen loading="lazy" allow="fullscreen" title={embed.title || "Transmissão na Twitch"} />
            </div>
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
          return <LinkPreviewCard key={key} embed={embed} />;
        }

        return null;
      })}
    </div>
  );
}
