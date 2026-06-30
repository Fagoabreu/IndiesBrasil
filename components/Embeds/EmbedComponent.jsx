import Image from "next/image";
import styles from "./EmbedComponent.module.css";
import InstagramEmbed from "./InstagramEmbed";
import PropTypes from "prop-types";

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
          return (
            <iframe
              key={key}
              src={embed.embedUrl}
              width="100%"
              height="190"
              frameBorder="0"
              scrolling="no"
              title="Steam Store Widget"
              style={{
                borderRadius: 8,
                overflow: "hidden",
              }}
            />
          );
        }

        if (embed.type === "preview") {
          return (
            <a key={key} href={embed.url} target="_blank" rel="noopener noreferrer" className={styles.previewCard}>
              {embed.image && (
                <div className={styles.previewImageWrapper}>
                  <Image
                    src={embed.image}
                    alt={embed.title || "Preview do link"}
                    fill
                    className={styles.previewImage}
                    sizes="(max-width: 400px) 100vw, 600px"
                    unoptimized
                  />
                </div>
              )}

              <div className={styles.previewContent}>
                <strong>{embed.title}</strong>
                <p>{embed.description}</p>
              </div>
            </a>
          );
        }

        return null;
      })}
    </div>
  );
}
