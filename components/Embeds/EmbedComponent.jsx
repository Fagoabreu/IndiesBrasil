import Image from "next/image";
import styles from "./EmbedComponent.module.css";

export default function EmbedComponent({ embeds }) {
  if (!embeds?.length) return null;
  return (
    <div>
      {embeds.map((embed, index) => {
        if (embed.type === "youtube") {
          return <iframe key={index} src={embed.embedUrl} height="400" width="100%" allowFullScreen />;
        }

        if (embed.type === "twitch") {
          return <iframe key={index} src={embed.embedUrl} height="400" width="100%" allowFullScreen />;
        }
        if (embed.type === "preview") {
          return (
            <a key={index} href={embed.url} target="_blank" rel="noopener noreferrer" className={styles.previewCard}>
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
