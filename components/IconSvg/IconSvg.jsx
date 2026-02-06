import Image from "next/image";
import styles from "./IconSvg.module.css";
import PropTypes from "prop-types";

IconSvg.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
};

export default function IconSvg({ src, alt }) {
  if (!src) return null;
  return <Image className={styles.contactIcon} src={src} alt={alt} width={25} height={25} unoptimized />;
}
