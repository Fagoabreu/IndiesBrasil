import { useEffect, useRef } from "react";
import styles from "./InstagramEmbed.module.css";

export default function InstagramEmbed({ url }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.instgrm) {
      const script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        window.instgrm.Embeds.process();
      };
    } else {
      window.instgrm.Embeds.process();
    }
  }, []);

  return <blockquote ref={ref} className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" />;
}
