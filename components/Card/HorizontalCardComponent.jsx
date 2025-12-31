import Image from "next/image";
import styles from "./HorizontalCardComponent.module.css";
import { Text } from "@primer/react";
import PropTypes from "prop-types";

HorizontalCardComponent.propTypes = {
  image: PropTypes.src,
  alt: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  tamanhoImagem: PropTypes.oneOf(["pequena", "media", "grande"]),
};

export default function HorizontalCardComponent({ image, alt, title, description }) {
  return (
    <div className={styles.card}>
      <div className={styles.imageWraper}>
        <Image className={styles.qrImage} src={image} alt={alt} fill style={{ objectFit: "contain" }} />
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle} size="medium">
          {title}
        </h3>
        <Text className={styles.cardText} size="medium" weight="light">
          {description}
        </Text>
      </div>
    </div>
  );
}
