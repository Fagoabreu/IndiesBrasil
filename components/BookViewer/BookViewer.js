"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./BookViewer.module.css";

/**
 * Converte URL do Cloudinary para obter cada página do PDF como imagem PNG.
 * Ex: /raw/upload/v123/book.pdf → /image/upload/pg_3/f_png/v123/book.pdf
 *
 * O Cloudinary precisa de um formato de saída explícito (f_png)
 * e do resource_type "image" para renderizar páginas de PDF como imagem.
 */
function pageImageUrl(pdfUrl, pageNum) {
  if (!pdfUrl) return "";
  // Remove fl_attachment se existir (raw files têm attachment por padrão)
  const cleaned = pdfUrl.replace(/fl_attachment[^/]*\//, "/");
  // Garante /image/upload/ (troca raw→image se necessário)
  const base = cleaned.replace(/\/(raw|image)\/upload\//, "/image/upload/");
  // Insere pg_N e força formato PNG via f_png
  return base.replace("/image/upload/", `/image/upload/pg_${pageNum}/f_png/`);
}

/**
 * Descobre o número de páginas carregando-as uma a uma
 * até encontrar uma que falhe.
 */
async function discoverPageCount(baseUrl, signal) {
  const maxPages = 500;
  for (let p = 1; p <= maxPages; p++) {
    if (signal.aborted) return p - 1;
    const ok = await probePageImage(pageImageUrl(baseUrl, p), signal);
    if (!ok) return p - 1;
  }
  return maxPages;
}

function probePageImage(url, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    const onAbort = () => {
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export default function BookViewer({ pdfUrl, title, onClose }) {
  const [numPages, setNumPages] = useState(0);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flipping, setFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState(null);

  const spreadContainerRef = useRef(null);

  // spreads: [ [leftPage, rightPage], ... ]
  // Capa sozinha no primeiro spread, demais em pares
  const spreads = useMemo(() => {
    const result = [];
    if (numPages > 0) {
      result.push([1, null]);
      for (let i = 2; i <= numPages; i += 2) {
        result.push([i, i + 1 <= numPages ? i + 1 : null]);
      }
    }
    return result;
  }, [numPages]);

  const totalSpreads = spreads.length;
  const hasPrev = currentSpread > 0;
  const hasNext = currentSpread < totalSpreads - 1;

  // Descobre número de páginas (probe progressivo via Cloudinary)
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        const count = await discoverPageCount(pdfUrl, controller.signal);
        if (cancelled) return;
        if (count === 0) {
          setError("Não foi possível carregar o PDF. Verifique se o arquivo está acessível.");
        }
        setNumPages(count);
      } catch (err) {
        if (!cancelled) {
          setError("Não foi possível carregar o PDF.");
          console.error("BookViewer error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pdfUrl]);

  const goToSpread = useCallback((idx, dir) => {
    setFlipDir(dir);
    setFlipping(true);
    setTimeout(() => {
      setCurrentSpread(idx);
      setFlipping(false);
      setFlipDir(null);
    }, 500);
  }, []);

  const goNext = useCallback(() => {
    if (!hasNext || flipping) return;
    goToSpread(currentSpread + 1, "forward");
  }, [hasNext, flipping, currentSpread, goToSpread]);

  const goPrev = useCallback(() => {
    if (!hasPrev || flipping) return;
    goToSpread(currentSpread - 1, "backward");
  }, [hasPrev, flipping, currentSpread, goToSpread]);

  const onCloseStable = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCloseStable();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onCloseStable]);

  function handlePageClick(e) {
    const rect = spreadContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev();
    else goNext();
  }

  const spread = spreads[currentSpread] || [null, null];
  const leftLabel = spread[0] ? `Página ${spread[0]}` : "";
  const rightLabel = spread[1] ? `Página ${spread[1]}` : "";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.viewer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title || "Visualizador de PDF"}</h2>
          <span className={styles.pageIndicator}>
            {spread[0] && spread[1] ? `Páginas ${spread[0]}–${spread[1]} de ${numPages}` : spread[0] ? `Página ${spread[0]} de ${numPages}` : ""}
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className={styles.bookArea}>
          {loading && <div className={styles.loadingMsg}>Analisando PDF...</div>}
          {error && <div className={styles.errorMsg}>{error}</div>}
          {!loading && !error && (
            <>
              <button className={`${styles.navBtn} ${styles.navLeft}`} onClick={goPrev} disabled={!hasPrev || flipping} aria-label="Página anterior">
                ‹
              </button>

              <div
                ref={spreadContainerRef}
                className={`${styles.spreadContainer} ${flipping ? styles.flipping : ""} ${flipDir === "forward" ? styles.flipForward : ""} ${flipDir === "backward" ? styles.flipBackward : ""}`}
                onClick={handlePageClick}
              >
                <div className={styles.spreadInner}>
                  {/* Página esquerda */}
                  <div className={`${styles.page} ${styles.pageLeft} ${!spread[1] ? styles.pageSingle : ""}`}>
                    {spread[0] && (
                      <Image src={pageImageUrl(pdfUrl, spread[0])} alt={`Página ${spread[0]}`} fill unoptimized className={styles.pageImg} />
                    )}
                    {leftLabel && <span className={styles.pageLabel}>{leftLabel}</span>}
                  </div>
                  {/* Página direita */}
                  {spread[1] && (
                    <div className={`${styles.page} ${styles.pageRight}`}>
                      <Image src={pageImageUrl(pdfUrl, spread[1])} alt={`Página ${spread[1]}`} fill unoptimized className={styles.pageImg} />
                      {rightLabel && <span className={styles.pageLabel}>{rightLabel}</span>}
                    </div>
                  )}
                </div>
              </div>

              <button className={`${styles.navBtn} ${styles.navRight}`} onClick={goNext} disabled={!hasNext || flipping} aria-label="Próxima página">
                ›
              </button>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span>🖱️ Clique nas laterais ou use ← → para folhear</span>
        </div>
      </div>
    </div>
  );
}
