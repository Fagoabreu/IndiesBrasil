import { useCallback, useEffect, useRef, useState } from "react";
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
  openSize: PropTypes.number,
};

export default function CarouselComponent({ cards, openSize = 720 }) {
  // `dockRef` guarda os cards na ordem de renderização: é por ele que o foco
  // volta ao gatilho quando o lightbox fecha.
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

  // showModal() é o que entrega o comportamento de modal de verdade: fundo
  // inerte, foco preso dentro, ::backdrop e Escape — tudo nativo, sem o
  // z-index + listener de teclado + backdrop clicável que existiam antes.
  // Roda no callback ref, e não num efeito, porque o <dialog> só entra no DOM
  // depois do clique: um efeito já teria executado (com a ref nula) no mount
  // do componente e nunca mais rodaria.
  const attachDialog = useCallback((node) => {
    if (node && !node.open) node.showModal();
  }, []);

  // O fundo fica inerte por causa do showModal(), mas ainda dá para rolar a
  // página atrás do lightbox.
  useEffect(() => {
    if (openIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex]);

  // Devolve o foco ao card que abriu o lightbox. Sem isso o foco cai no <body>
  // e quem navega por teclado perde a posição na página.
  useEffect(() => {
    if (openIndex === null) return;
    const dock = dockRef.current;
    return () => dock?.children[openIndex]?.focus();
  }, [openIndex]);

  if (!cards.length) return null;

  const openCard = openIndex !== null ? cards[openIndex] : null;

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.dock} ${openIndex !== null ? styles.dockDimmed : ""}`} ref={dockRef}>
        {cards.map((card, i) => (
          <button
            type="button"
            key={card.image_src}
            className={styles.card}
            onClick={() => setOpenIndex(i)}
            aria-haspopup="dialog"
            title={card.content}
          >
            <span className={styles.stage}>
              {/* alt vazio: o nome acessível do botão já vem da legenda, e
                  repetir o texto no alt faria o leitor de tela anunciar duas vezes. */}
              <Image
                src={card.image_src}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 640px) 76vw, (max-width: 1000px) 45vw, 380px"
                priority={i < 3}
                className={styles.stageImage}
              />
            </span>
            <span className={styles.caption}>{card.content}</span>
          </button>
        ))}
      </div>

      {openCard && (
        <dialog
          ref={attachDialog}
          className={styles.dialog}
          style={{ "--open-size": `${openSize}px` }}
          aria-label={openCard.content}
          onCancel={(event) => {
            // O <dialog> se fecharia sozinho no Escape, mas o estado precisa
            // acompanhar: se ele ficasse "aberto" no React, reabrir o mesmo
            // card não faria efeito (setState com valor igual é ignorado).
            // Fechar por clique no ::backdrop saiu de propósito — é um atalho
            // só de mouse; o X e o Escape (ambos acessíveis por teclado)
            // continuam fechando.
            event.preventDefault();
            setOpenIndex(null);
          }}
        >
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
              sizes="720px"
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
        </dialog>
      )}
    </div>
  );
}
