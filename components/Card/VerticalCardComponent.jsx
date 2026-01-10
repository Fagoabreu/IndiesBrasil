import Image from "next/image";
import styles from "./VerticalCardComponent.module.css";
import { Text } from "@primer/react";
import PropTypes from "prop-types";

VerticalCardComponent.propTypes = {
  image: PropTypes.string,
  alt: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
};

export default function VerticalCardComponent({ image, alt, title, description }) {
  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        <Image src={image} alt={alt} fill className={styles.image} unoptimized />
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>

        <Text className={styles.cardText}>{description}</Text>
      </div>
    </div>
  );
}
