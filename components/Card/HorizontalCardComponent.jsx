import Image from "next/image";
import styles from "./HorizontalCardComponent.module.css";
import { Text } from "@primer/react";
import PropTypes from "prop-types";

HorizontalCardComponent.propTypes = {
  image: PropTypes.src,
  alt: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
};

export default function HorizontalCardComponent({ image, alt, title, description }) {
  return (
    <>
      <div className={styles.divImage}>
        <Image className={styles.qrImage} src={image} alt={alt} width={260} height={260} />
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle} size="medium">
            {title}
          </h3>
          <Text className={styles.cardText} size="medium" weight="light">
            {description}
          </Text>
        </div>
      </div>
    </>
  );
}
