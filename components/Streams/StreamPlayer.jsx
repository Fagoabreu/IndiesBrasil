import { useRef } from "react";
import PropTypes from "prop-types";
import { BroadcastIcon, ScreenFullIcon } from "@primer/octicons-react";
import styles from "./StreamPlayer.module.css";

/**
 * Superfície de vídeo da transmissão (16:9), no espírito do player da Twitch e
 * do YouTube: ocupa toda a largura disponível e tem o seu próprio controle de
 * tela cheia, além do que a plataforma oferece dentro do iframe.
 *
 * Recebe o endereço **já resolvido** (`getEmbedUrl`, em `lib/streams.js`) em vez
 * do estúdio: quem sabe qual plataforma está no ar é o model, e o `parent` do
 * player da Twitch tem de ser o host da requisição — no SSR isso não é
 * `window.location`.
 *
 * `src` nulo é o estado offline: o YouTube não embute canal fora do ar, e a
 * página precisa de algo no lugar do iframe (a Twitch embute, então esse caso
 * chega aqui como `src` preenchido — ver `embedWhenOffline` no registro).
 */
export default function StreamPlayer({ src, title, platformLabel, watchUrl, offlineMessage }) {
  const wrapperRef = useRef(null);

  async function goFullscreen() {
    try {
      await wrapperRef.current?.requestFullscreen();
    } catch {
      // Navegador sem a API (ou permissão negada): o player da plataforma ainda
      // oferece o controle de tela cheia por dentro do iframe.
    }
  }

  if (!src) {
    return (
      <div className={`${styles.player} ${styles.offline}`}>
        <BroadcastIcon size={40} />
        <p className={styles.offlineTitle}>{offlineMessage || "Este canal está offline"}</p>
        <p className={styles.offlineHint}>Quando a transmissão começar, ela aparece aqui.</p>
        {watchUrl && (
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className={styles.offlineLink}>
            {platformLabel ? `Abrir canal na ${platformLabel}` : "Abrir canal"}
          </a>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={styles.player}>
      <iframe className={styles.frame} src={src} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      <button type="button" className={styles.fullscreenBtn} onClick={goFullscreen} title="Tela cheia" aria-label="Ver em tela cheia">
        <ScreenFullIcon size={16} />
      </button>
    </div>
  );
}

StreamPlayer.propTypes = {
  /* Endereço do player embutido; `null` mostra o estado offline. */
  src: PropTypes.string,
  title: PropTypes.string.isRequired,
  platformLabel: PropTypes.string,
  /* Canal na plataforma — o caminho para quem preferir assistir por lá. */
  watchUrl: PropTypes.string,
  offlineMessage: PropTypes.string,
};
