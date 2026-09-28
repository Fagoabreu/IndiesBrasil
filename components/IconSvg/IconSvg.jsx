import { useState } from "react";
import Image from "next/image";
import { LinkIcon } from "@primer/octicons-react";
import styles from "./IconSvg.module.css";
import PropTypes from "prop-types";

IconSvg.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  /** Mostrar um ícone genérico quando o arquivo não existe ou falha ao carregar. */
  fallback: PropTypes.bool,
};

/**
 * Ícone quadrado servido de `/public/images/<pasta>/<arquivo>.svg`.
 *
 * O `icon_img` de um tipo de contato é digitado por quem administra
 * `/admin/contact-types`, então pode apontar para um arquivo que não existe — e
 * o resultado era um ícone quebrado, sem aviso. Com `fallback`, o espaço recebe
 * um ícone genérico e a linha continua legível.
 *
 * @param {{ src?: string, alt?: string, fallback?: boolean }} props
 */
export default function IconSvg({ src, alt, fallback = false }) {
  // `useState` e não só `if (!src)`: o caso comum não é o `src` ausente, e sim
  // o caminho que existe na string mas não no disco — só o `onError` pega esse.
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (!fallback) return null;
    return <LinkIcon size={20} className={styles.fallbackIcon} aria-hidden="true" />;
  }

  return <Image className={styles.contactIcon} src={src} alt={alt ?? ""} width={25} height={25} unoptimized onError={() => setFailed(true)} />;
}
