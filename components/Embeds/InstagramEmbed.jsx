import { useEffect, useRef } from "react";
import styles from "./InstagramEmbed.module.css";
import Script from "next/script";
import PropTypes from "prop-types";

InstagramEmbed.propTypes = {
  url: PropTypes.string.isRequired,
};

export default function InstagramEmbed({ url }) {
  const ref = useRef(null);

  useEffect(() => {
    if (globalThis.instgrm?.Embeds) {
      globalThis.instgrm.Embeds.process();
    }
  }, []);

  return (
    <div className={styles.wrapper}>
      {/* Script controlado pelo Next.js */}
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="lazyOnload"
        onLoad={() => {
          globalThis.instgrm?.Embeds.process();
        }}
      />
      <blockquote ref={ref} className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" />
    </div>
  );
}
