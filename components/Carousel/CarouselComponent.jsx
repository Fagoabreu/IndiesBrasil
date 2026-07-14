import { useRef, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Image from "next/image";
import Link from "next/link";
import styles from "./CarouselComponent.module.css";

CarouselComponent.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      image_src: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
      href: PropTypes.string,
    }),
  ).isRequired,
};

export default function CarouselComponent({ cards }) {
  const total = cards.length;
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollTo = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = track.children[0]?.offsetWidth || 1;
    track.scrollTo({ left: cardWidth * index, behavior: "smooth" });
    setActiveIndex(index);
  }, []);

  function handlePrev() {
    scrollTo(Math.max(activeIndex - 1, 0));
  }

  function handleNext() {
    scrollTo(Math.min(activeIndex + 1, total - 1));
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function onScroll() {
      const cardWidth = track.children[0]?.offsetWidth || 1;
      const idx = Math.round(track.scrollLeft / cardWidth);
      setActiveIndex(Math.min(idx, total - 1));
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [total]);

  const noopLoader = ({ src, width, quality }) =>
    `${src}?w=${width}&q=${quality || 75}`;

  function renderCard(card, i) {
    const inner = (
      <>
        <div className={styles.imageWrap}>
          <Image
            src={card.image_src}
            alt={card.content}
            loader={noopLoader}
            fill
            className={styles.image}
            sizes="(max-width: 640px) 85vw, 300px"
            priority={i < 3}
          />
        </div>
        <div className={styles.label}>
          <span>{card.content}</span>
        </div>
      </>
    );

    if (card.href) {
      return (
        <Link key={i} href={card.href} className={styles.card}>
          {inner}
        </Link>
      );
    }

    return (
      <div key={i} className={styles.card}>
        {inner}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.track} ref={trackRef}>
        {cards.map((card, i) => renderCard(card, i))}
      </div>

      <div className={styles.fadeLeft} />
      <div className={styles.fadeRight} />

      {activeIndex > 0 && (
        <button
          className={`${styles.navBtn} ${styles.navLeft}`}
          onClick={handlePrev}
          aria-label="Anterior"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {activeIndex < total - 1 && (
        <button
          className={`${styles.navBtn} ${styles.navRight}`}
          onClick={handleNext}
          aria-label="Próximo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      <div className={styles.dots}>
        {cards.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`}
            onClick={() => scrollTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
