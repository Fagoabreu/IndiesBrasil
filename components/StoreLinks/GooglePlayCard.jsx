import { useEffect, useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import { googlePlayUrl, storeAppTitle, storeCtaLabel } from "@/lib/storeLinks";

import styles from "./GooglePlayCard.module.css";

/**
 * Card de loja que não tem widget para incorporar (Google Play).
 *
 * **Nasce completo** com o que já é nosso — `gameName`, preço no cabeçalho do
 * card e `page_url` — e só se enriquece se `/api/v1/link-preview` responder. A
 * Play bloqueia IP de datacenter com frequência (429/anti-bot) e o
 * `fetchLinkPreview` devolve `null` nesse caso; depender dela para desenhar
 * deixaria a seção "Onde comprar" com um card vazio, que é exatamente o defeito
 * que este componente corrige (`storeSimpleLink` mostrava só "Visitar loja ↗").
 *
 * O `<a href>` sai no HTML do SSR: o destino é derivado do id do pacote, não do
 * preview.
 */
export default function GooglePlayCard({ url, gameName, logoSrc = null }) {
  // `undefined` = o preview ainda não voltou; `null` = voltou vazio ou falhou.
  // Os dois desenham o mesmo card — não existe estado de "carregando".
  const [preview, setPreview] = useState(undefined);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/v1/link-preview?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setPreview(data ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setPreview(null);
      });

    return () => controller.abort();
  }, [url]);

  const href = googlePlayUrl(url) ?? url;
  // Nome do jogo até o preview chegar: é informação nossa e evita o card dizer
  // apenas o nome da loja, que já está no cabeçalho.
  const title = storeAppTitle(preview?.title) || gameName || "Google Play";
  // `image` é o ícone do app (512px); `icon` é o favicon da loja, que serve como
  // segunda opção. O logo local fica por último, para o card nunca ficar sem arte.
  const artwork = preview?.image || preview?.icon || logoSrc;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.card}>
      {artwork ? (
        <Image src={artwork} alt="" width={56} height={56} className={styles.icon} unoptimized />
      ) : (
        <span className={styles.iconFallback} aria-hidden="true">
          ▶
        </span>
      )}

      <span className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        {preview?.description && <span className={styles.desc}>{preview.description}</span>}
      </span>

      <span className={styles.cta}>{storeCtaLabel("Google Play")} ↗</span>
    </a>
  );
}

GooglePlayCard.propTypes = {
  /** `store_page.page_url` cadastrado pelo estúdio — pode vir com `hl`/`gl`/utm. */
  url: PropTypes.string.isRequired,
  /** `game.name`: título do card enquanto o preview não chega. */
  gameName: PropTypes.string,
  /** Logo local da loja, usado quando o preview não trouxer imagem. */
  logoSrc: PropTypes.string,
};
