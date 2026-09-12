import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Image from "next/image";
import Link from "next/link";
import styles from "./CarouselComponent.module.css";

const LERP = 0.16;

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// Falloff "smoothstep": suaviza a transição perto do cursor.
function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

CarouselComponent.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      image_src: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
      href: PropTypes.string,
    }),
  ).isRequired,
  collapsedWidth: PropTypes.number,
  hoverWidth: PropTypes.number,
  collapsedHeight: PropTypes.number,
  hoverHeight: PropTypes.number,
  openSize: PropTypes.number,
  gap: PropTypes.number,
  influence: PropTypes.number,
  blur: PropTypes.number,
};

export default function CarouselComponent({
  cards,
  collapsedWidth = 200,
  hoverWidth = 300,
  collapsedHeight = 180,
  hoverHeight = 220,
  openSize = 600,
  gap = 16,
  influence = 200,
  blur = 2,
}) {
  const rowRef = useRef(null);
  const dockRef = useRef(null);
  const imageWrapRef = useRef(null);
  const [openIndex, setOpenIndex] = useState(null);

  // Ajusta o container da imagem expandida à proporção natural da figura (sem recorte).
  function handleExpandedImageLoad(event) {
    const wrap = imageWrapRef.current;
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (wrap && naturalWidth > 0 && naturalHeight > 0) {
      wrap.style.aspectRatio = `${naturalWidth} / ${naturalHeight}`;
    }
  }

  // Efeito dock: amplia as barras conforme a proximidade do cursor (somente hover).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;

    const dock = dockRef.current;
    const row = rowRef.current;
    if (!dock || !row) return;

    const bars = Array.from(dock.children);
    if (bars.length === 0) return;

    const sizes = bars.map(() => ({ w: collapsedWidth, h: collapsedHeight }));
    let baseW = collapsedWidth;
    const range = Math.max(influence, 1);
    let hovering = false;
    let pointerX = -influence;
    let rafId = null;

    // Distribui as barras pela largura total da linha (como os demais componentes).
    function computeBase() {
      const rowWidth = row.clientWidth;
      if (rowWidth <= 0) return;
      const totalGap = gap * (bars.length - 1);
      const available = rowWidth - totalGap;
      baseW = Math.min(hoverWidth, Math.max(120, available / bars.length));
    }

    computeBase();
    sizes.forEach((size) => {
      size.w = baseW;
      size.h = collapsedHeight;
    });
    bars.forEach((bar) => {
      bar.style.width = `${baseW}px`;
      bar.style.height = `${collapsedHeight}px`;
    });

    function applyFrame() {
      const dockRect = dock.getBoundingClientRect();
      let settled = true;

      for (let i = 0; i < bars.length; i++) {
        const current = sizes[i];
        const barRect = bars[i].getBoundingClientRect();
        const center = barRect.left - dockRect.left + barRect.width / 2;
        const distance = Math.abs(pointerX - center);
        const strength = smoothstep(1 - distance / range);
        const targetW = baseW + (hoverWidth - baseW) * strength;
        const targetH = collapsedHeight + (hoverHeight - collapsedHeight) * strength;

        current.w += (targetW - current.w) * LERP;
        current.h += (targetH - current.h) * LERP;
        bars[i].style.width = `${current.w}px`;
        bars[i].style.height = `${current.h}px`;

        if (Math.abs(targetW - current.w) > 0.3 || Math.abs(targetH - current.h) > 0.3) {
          settled = false;
        }
      }

      if (!hovering && settled) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(applyFrame);
    }

    function start() {
      if (rafId === null) rafId = requestAnimationFrame(applyFrame);
    }

    function onMove(event) {
      const rect = dock.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      hovering = true;
      start();
    }

    function onLeave() {
      hovering = false;
      pointerX = -influence;
      start();
    }

    function onResize() {
      computeBase();
      start();
    }

    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [cards.length, collapsedWidth, hoverWidth, collapsedHeight, hoverHeight, gap, influence]);

  // Fecha com Escape e trava o scroll da página enquanto o overlay está aberto.
  useEffect(() => {
    if (openIndex === null) return;

    function onKey(event) {
      if (event.key === "Escape") setOpenIndex(null);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex]);

  if (!cards.length) return null;

  const openCard = openIndex !== null ? cards[openIndex] : null;

  const rowStyle = {
    "--collapsed-width": `${collapsedWidth}px`,
    "--collapsed-height": `${collapsedHeight}px`,
    "--hover-height": `${hoverHeight}px`,
    "--gap": `${gap}px`,
    "--blur": `${blur}px`,
  };

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.row} ${openIndex !== null ? styles.rowDimmed : ""}`} ref={rowRef} style={rowStyle}>
        <div className={styles.dock} ref={dockRef}>
          {cards.map((card, i) => (
            <button
              type="button"
              key={card.image_src}
              className={styles.bar}
              onClick={() => setOpenIndex(i)}
              aria-label={card.content}
              aria-expanded={openIndex === i}
              title={card.content}
            >
              <span className={styles.barImageWrap}>
                <Image src={card.image_src} alt={card.content} fill unoptimized sizes="200px" priority={i < 3} className={styles.barImage} />
              </span>
              <span className={styles.barLabel}>{card.content}</span>
            </button>
          ))}
        </div>
      </div>

      {openCard && (
        <div className={styles.overlay}>
          <button type="button" className={styles.backdrop} onClick={() => setOpenIndex(null)} aria-label="Fechar" />

          <div className={styles.expanded} style={{ "--open-size": `${openSize}px` }}>
            <button type="button" className={styles.closeBtn} onClick={() => setOpenIndex(null)} aria-label="Fechar" autoFocus>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className={styles.expandedImageWrap} ref={imageWrapRef}>
              <Image
                src={openCard.image_src}
                alt={openCard.content}
                fill
                unoptimized
                sizes="600px"
                style={{ objectFit: "contain" }}
                onLoad={handleExpandedImageLoad}
                className={styles.expandedImage}
              />
            </div>

            <p className={styles.expandedLabel}>{openCard.content}</p>

            {openCard.href && (
              <Link href={openCard.href} className={styles.expandedLink}>
                Visitar
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
