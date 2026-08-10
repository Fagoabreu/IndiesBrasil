"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./BookViewer.module.css";

/**
 * PDFs enviados como resource_type "image" no Cloudinary suportam
 * transformações pg_N (renderização de página como imagem).
 * PDFs "raw" usam pdfjs-dist para renderizar no canvas.
 */
function isImagePdf(pdfUrl) {
  return pdfUrl?.includes("/image/upload/");
}

/**
 * Converte URL do Cloudinary para obter cada página do PDF como imagem PNG.
 * Só funciona para PDFs com resource_type "image".
 */
function pageImageUrl(pdfUrl, pageNum) {
  if (!pdfUrl) return "";
  const cleaned = pdfUrl.replace(/fl_attachment[^/]*\//, "/");
  const base = cleaned.replace(/\/(raw|image)\/upload\//, "/image/upload/");
  return base.replace("/image/upload/", `/image/upload/pg_${pageNum}/f_png/`);
}

/**
 * Para PDFs image: descobre o número de páginas via probe progressivo.
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

/**
 * BookViewer — suporta dois modos:
 * - PDF image (Cloudinary): spread view com pg_N, cada página é uma <Image>
 * - PDF raw: renderiza páginas via pdfjs-dist em canvas (resolve problema de
 *   Content-Disposition: attachment do Cloudinary que forçava download)
 */
export default function BookViewer({ pdfUrl, title, onClose }) {
  const imageMode = isImagePdf(pdfUrl);

  // ── Modo image (pg_N) ──
  const [numPages, setNumPages] = useState(0);
  const [imageLoading, setImageLoading] = useState(imageMode);
  const [imageError, setImageError] = useState(null);

  // ── Modo raw (pdfjs-dist canvas) ──
  const [rawNumPages, setRawNumPages] = useState(0);
  const [rawLoading, setRawLoading] = useState(!imageMode);
  const [rawError, setRawError] = useState(null);

  // ── Compartilhado ──
  const [currentSpread, setCurrentSpread] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState(null);
  const pdfDocRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const spreadContainerRef = useRef(null);

  const effectiveNumPages = imageMode ? numPages : rawNumPages;
  const effectiveLoading = imageMode ? imageLoading : rawLoading;
  const effectiveError = imageMode ? imageError : rawError;

  const spreads = useMemo(() => {
    const result = [];
    const n = effectiveNumPages;
    if (n > 0) {
      result.push([1, null]);
      for (let i = 2; i <= n; i += 2) {
        result.push([i, i + 1 <= n ? i + 1 : null]);
      }
    }
    return result;
  }, [effectiveNumPages]);

  const totalSpreads = spreads.length;
  const hasPrev = currentSpread > 0;
  const hasNext = currentSpread < totalSpreads - 1;

  // ── Modo image: descobre número de páginas ──
  useEffect(() => {
    if (!imageMode) return;

    const controller = new AbortController();
    let cancelled = false;

    async function init() {
      try {
        setImageLoading(true);
        setImageError(null);
        const count = await discoverPageCount(pdfUrl, controller.signal);
        if (cancelled) return;
        if (count === 0) {
          setImageError("Não foi possível carregar o PDF. Verifique se o arquivo está acessível.");
        }
        setNumPages(count);
      } catch (err) {
        if (!cancelled) {
          setImageError("Não foi possível carregar o PDF.");
          console.error("BookViewer error:", err);
        }
      } finally {
        if (!cancelled) setImageLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pdfUrl, imageMode]);

  // ── Modo raw: carrega PDF com pdfjs-dist ──
  useEffect(() => {
    if (imageMode) return;

    let cancelled = false;

    async function loadRawPdf() {
      try {
        setRawLoading(true);
        setRawError(null);

        const pdfjsLib = await import("pdfjs-dist");
        const pdfjsVersion = pdfjsLib.version || "6.2.108";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/cmaps/`,
          cMapPacked: true,
        }).promise;

        if (cancelled) return;
        pdfDocRef.current = pdf;
        setRawNumPages(pdf.numPages);
      } catch (err) {
        if (!cancelled) {
          console.error("BookViewer raw PDF error:", err);
          setRawError("Não foi possível carregar o PDF. Verifique se o arquivo está acessível.");
        }
      } finally {
        if (!cancelled) setRawLoading(false);
      }
    }

    loadRawPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, imageMode]);

  // ── Modo raw: renderiza páginas da spread atual nos canvas ──
  useEffect(() => {
    if (imageMode || !pdfDocRef.current || spreads.length === 0) return;

    const spread = spreads[currentSpread];
    if (!spread) return;

    const pages = spread.filter(Boolean);
    let cancelled = false;

    async function renderSpread() {
      const container = canvasContainerRef.current;
      if (!container) return;

      // Limpa canvas anteriores
      container.innerHTML = "";

      for (const pageNum of pages) {
        if (cancelled) return;

        try {
          const page = await pdfDocRef.current.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 });

          // Calcula escala para caber no container mantendo proporção
          const containerWidth = container.clientWidth / pages.length;
          const containerHeight = container.clientHeight;
          const scale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height);

          const canvas = document.createElement("canvas");
          canvas.className = styles.rawPageCanvas;
          const scaledViewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = `${scaledViewport.width / (window.devicePixelRatio || 1)}px`;
          canvas.style.height = `${scaledViewport.height / (window.devicePixelRatio || 1)}px`;

          const wrapper = document.createElement("div");
          wrapper.className = styles.rawPageWrapper;

          if (pages.length === 1) {
            wrapper.classList.add(styles.rawPageSingle);
          }

          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          await page.render({
            canvasContext: canvas.getContext("2d"),
            viewport: scaledViewport,
          }).promise;
        } catch (err) {
          console.error(`Erro ao renderizar página ${pageNum}:`, err);
        }
      }
    }

    renderSpread();
    return () => {
      cancelled = true;
    };
  }, [imageMode, spreads, currentSpread]);

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
    if (flipping || !hasNext) return;
    goToSpread(currentSpread + 1, "forward");
  }, [flipping, hasNext, currentSpread, goToSpread]);

  const goPrev = useCallback(() => {
    if (flipping || !hasPrev) return;
    goToSpread(currentSpread - 1, "backward");
  }, [flipping, hasPrev, currentSpread, goToSpread]);

  const onCloseStable = useCallback(() => {
    onClose();
  }, [onClose]);

  // Teclado
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
    const rect = spreadContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev();
    else goNext();
  }

  const spread = spreads[currentSpread] || [null, null];

  let pageIndicator;
  if (spread[0] && spread[1]) {
    pageIndicator = `Páginas ${spread[0]}–${spread[1]} de ${effectiveNumPages}`;
  } else if (spread[0]) {
    pageIndicator = `Página ${spread[0]} de ${effectiveNumPages}`;
  } else {
    pageIndicator = "";
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Visualizador de PDF"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCloseStable();
      }}
    >
      <div className={styles.viewer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.titleIcon}>📖</span>
            <h2 className={styles.title}>{title || "Visualizador de PDF"}</h2>
          </div>
          <span className={styles.pageIndicator}>{pageIndicator}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className={styles.bookArea}>
          {effectiveLoading && (
            <div className={styles.loadingMsg}>
              <div className={styles.spinner} />
              <span>Carregando PDF...</span>
            </div>
          )}
          {effectiveError && <div className={styles.errorMsg}>{effectiveError}</div>}

          {!effectiveLoading && !effectiveError && (
            <>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.navLeft}`}
                onClick={goPrev}
                disabled={!hasPrev || flipping}
                aria-label="Página anterior"
              >
                ‹
              </button>

              {/* ──── Modo image (pg_N) ──── */}
              {imageMode && (
                <div
                  ref={spreadContainerRef}
                  className={`${styles.spreadContainer} ${flipping ? styles.flipping : ""} ${flipDir === "forward" ? styles.flipForward : ""} ${flipDir === "backward" ? styles.flipBackward : ""}`}
                  onClick={handlePageClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") goNext();
                    else if (e.key === "ArrowLeft") goPrev();
                  }}
                >
                  <div className={styles.spreadInner}>
                    <div className={`${styles.page} ${styles.pageLeft} ${!spread[1] ? styles.pageSingle : ""}`}>
                      {spread[0] && (
                        <Image src={pageImageUrl(pdfUrl, spread[0])} alt={`Página ${spread[0]}`} fill unoptimized className={styles.pageImg} />
                      )}
                      {spread[0] && <span className={styles.pageLabel}>Página {spread[0]}</span>}
                    </div>
                    {spread[1] && (
                      <div className={`${styles.page} ${styles.pageRight}`}>
                        <Image src={pageImageUrl(pdfUrl, spread[1])} alt={`Página ${spread[1]}`} fill unoptimized className={styles.pageImg} />
                        <span className={styles.pageLabel}>Página {spread[1]}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ──── Modo raw (pdfjs-dist canvas) ──── */}
              {!imageMode && (
                <div
                  ref={(node) => {
                    spreadContainerRef.current = node;
                  }}
                  className={`${styles.spreadContainer} ${styles.rawSpreadContainer} ${flipping ? styles.flipping : ""} ${flipDir === "forward" ? styles.flipForward : ""} ${flipDir === "backward" ? styles.flipBackward : ""}`}
                  onClick={handlePageClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") goNext();
                    else if (e.key === "ArrowLeft") goPrev();
                  }}
                >
                  <div className={styles.spreadInner}>
                    <div ref={canvasContainerRef} className={styles.rawCanvasContainer} />
                  </div>
                </div>
              )}

              <button
                type="button"
                className={`${styles.navBtn} ${styles.navRight}`}
                onClick={goNext}
                disabled={!hasNext || flipping}
                aria-label="Próxima página"
              >
                ›
              </button>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>🖱️ Clique nas laterais</span>
          <span className={styles.footerDot} />
          <span className={styles.footerHint}>← → Teclado</span>
          <span className={styles.footerDot} />
          <span className={styles.footerHint}>Esc Fechar</span>
        </div>
      </div>
    </div>
  );
}
