import { useEffect, useRef } from "react";
import styles from "./InstagramEmbed.module.css";
import Script from "next/script";

export default function InstagramEmbed({ url }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.instgrm?.Embeds) {
      window.instgrm.Embeds.process();
    }
  }, []);

  return (
    <div className={styles.wrapper}>
      {/* Script controlado pelo Next.js */}
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="lazyOnload"
        onLoad={() => {
          window.instgrm?.Embeds.process();
        }}
      />
      <blockquote ref={ref} className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" />
    </div>
  );
}
