"use client";
import { useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import styles from "./GameMediaPlayer.module.css";

function toEmbedUrl(url) {
  if (!url) return url;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return url;
}

/**
 * Reusable media player with thumbnail strip — mirrors the Steam-style hero layout.
 *
 * Props:
 *   media      — array of { id, media_type: "video"|"image", url, caption }
 *   trailerUrl — optional standalone trailer URL (merged as first entry if not already in media)
 *   bannerUrl  — fallback image shown when there is no active media entry
 *   name       — product name for alt text
 */
export default function GameMediaPlayer({ media = [], trailerUrl, bannerUrl, name = "" }) {
  const trailerEntry =
    trailerUrl && !media.some((m) => m.url === trailerUrl) ? [{ id: "__trailer__", media_type: "video", url: trailerUrl, caption: "Trailer" }] : [];
  const allMedia = [...trailerEntry, ...media];

  const [activeMedia, setActiveMedia] = useState(allMedia[0] ?? null);

  let mainView = null;
  if (activeMedia?.media_type === "video") {
    mainView = (
      <div className={styles.videoWrap}>
        <iframe
          src={toEmbedUrl(activeMedia.url)}
          title={activeMedia.caption || "Trailer"}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className={styles.videoFrame}
        />
      </div>
    );
  } else if (activeMedia) {
    mainView = (
      <Image src={activeMedia.url} alt={activeMedia.caption || name} fill sizes="(max-width: 860px) 100vw, 640px" className={styles.mainImg} />
    );
  } else if (bannerUrl) {
    mainView = <Image src={bannerUrl} alt={name} fill priority sizes="(max-width: 860px) 100vw, 640px" className={styles.mainImg} />;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.main}>{mainView}</div>

      {allMedia.length > 0 && (
        <div className={styles.thumbs}>
          {allMedia.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.thumb} ${activeMedia?.id === m.id ? styles.thumbActive : ""}`}
              onClick={() => setActiveMedia(m)}
            >
              {m.media_type === "video" ? (
                <span className={styles.thumbVideo}>▶</span>
              ) : (
                <Image src={m.url} alt={m.caption || ""} fill sizes="120px" className={styles.thumbImg} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

GameMediaPlayer.propTypes = {
  media: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      media_type: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      caption: PropTypes.string,
    }),
  ),
  trailerUrl: PropTypes.string,
  bannerUrl: PropTypes.string,
  name: PropTypes.string,
};
