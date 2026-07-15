"use client";
import { useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import InstagramEmbed from "@/components/Embeds/InstagramEmbed";
import styles from "./GameMediaPlayer.module.css";

function isInstagramUrl(url) {
  if (!url) return false;
  return /instagram\.com\/(p|reel|tv)\//.test(url);
}

function toEmbedUrl(url) {
  if (!url) return url;
  // youtube.com/watch?v=ID
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  // youtube.com/shorts/ID
  match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

function getVideoThumbnail(url) {
  if (!url) return null;
  // youtube.com/watch?v=ID  /  youtu.be/ID  /  youtube.com/shorts/ID
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  return null;
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
    trailerUrl && !media.some((m) => m.url === trailerUrl)
      ? [
          {
            id: "__trailer__",
            media_type: "video",
            url: trailerUrl,
            caption: "Trailer",
          },
        ]
      : [];
  const allMedia = [...trailerEntry, ...media];

  const [activeMedia, setActiveMedia] = useState(allMedia[0] ?? null);

  let mainView = null;
  if (activeMedia?.media_type === "video") {
    if (isInstagramUrl(activeMedia.url)) {
      mainView = (
        <div className={styles.instagramWrap}>
          <div className={styles.instagramInner}>
            <InstagramEmbed url={activeMedia.url} />
          </div>
        </div>
      );
    } else {
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
    }
  } else if (activeMedia) {
    mainView = (
      <Image
        src={activeMedia.url}
        alt={activeMedia.caption || name}
        fill
        priority
        sizes="(max-width: 860px) 100vw, 640px"
        className={styles.mainImg}
      />
    );
  } else if (bannerUrl) {
    mainView = <Image src={bannerUrl} alt={name} fill priority sizes="(max-width: 860px) 100vw, 640px" className={styles.mainImg} />;
  }

  const isInstagram = activeMedia?.media_type === "video" && isInstagramUrl(activeMedia.url);

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.main} ${isInstagram ? styles.mainInstagram : ""}`}>{mainView}</div>

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
                getVideoThumbnail(m.url) ? (
                  <>
                    <Image src={getVideoThumbnail(m.url)} alt={m.caption || ""} fill sizes="120px" className={styles.thumbImg} unoptimized />
                    <span className={styles.thumbVideo}>▶</span>
                  </>
                ) : (
                  <span className={styles.thumbVideo}>▶</span>
                )
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
