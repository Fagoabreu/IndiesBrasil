import { useRef, useState } from "react";
import { IconButton } from "@primer/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@primer/octicons-react";
import styles from "./CarouselComponent.module.css";
import PropTypes from "prop-types";
import Image from "next/image";

CarouselComponent.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      image_src: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default function CarouselComponent({ cards }) {
  const TOTAL_CARDS = cards.length;
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollToIndex(index) {
    const container = containerRef.current;
    if (!container) return;

    const cardWidth = container.firstChild.offsetWidth;
    container.scrollTo({
      left: cardWidth * index,
      behavior: "smooth",
    });

    setActiveIndex(index);
  }

  function handlePrev() {
    scrollToIndex(Math.max(activeIndex - 1, 0));
  }

  function handleNext() {
    scrollToIndex(Math.min(activeIndex + 1, TOTAL_CARDS - 1));
  }

  const noopImageLoader = ({ src }) => src;

  return (
    <div className={styles.wrapper}>
      <IconButton aria-label="Anterior" icon={ChevronLeftIcon} onClick={handlePrev} className={styles.navLeft} />

      <div className={styles.carousel} ref={containerRef}>
        {cards.map((card, index) => (
          <div className={styles.card} key={index}>
            <div className={styles.imageWrapper}>
              <Image
                src={card.image_src}
                alt={card.content}
                loader={noopImageLoader}
                fill
                className={styles.image}
                sizes="(max-width: 600px) 100vw, 320px"
                priority={index === 0}
              />
            </div>

            <div className={styles.content}>
              <h3>{card.content}</h3>
            </div>
          </div>
        ))}
      </div>

      <IconButton aria-label="Próximo" icon={ChevronRightIcon} onClick={handleNext} className={styles.navRight} />

      <div className={styles.dots}>
        {Array.from({ length: TOTAL_CARDS }).map((_, index) => (
          <button
            key={index}
            className={`${styles.dot} ${index === activeIndex ? styles.activeDot : ""}`}
            onClick={() => scrollToIndex(index)}
            aria-label={`Ir para card ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
