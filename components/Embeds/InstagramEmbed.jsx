import { useEffect, useRef } from "react";
import styles from "./InstagramEmbed.module.css";
import Script from "next/script";
import PropTypes from "prop-types";
import { normalizeInstagramUrl } from "@/lib/embedLinks";

InstagramEmbed.propTypes = {
  url: PropTypes.string.isRequired,
};

export default function InstagramEmbed({ url }) {
  const ref = useRef(null);

  // O `embed.js` monta o iframe a partir do `data-instgrm-permalink`, e o
  // caminho `/reels/<id>` (o que o app do Instagram compartilha) responde 404 em
  // `/embed/captioned/` — o iframe não carregava. `/reel/<id>` responde 200.
  // A normalização vive em `lib/embedLinks.js` para valer também no servidor,
  // e este fallback conserta post já publicado com o link antigo.
  const permalink = normalizeInstagramUrl(url) ?? url;

  useEffect(() => {
    if (globalThis.instgrm?.Embeds) {
      globalThis.instgrm.Embeds.process();
    }
  }, [permalink]);

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
      <blockquote ref={ref} className="instagram-media" data-instgrm-permalink={permalink} data-instgrm-version="14" />
    </div>
  );
}
