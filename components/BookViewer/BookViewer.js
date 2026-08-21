"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * - PDF image (Cloudinary): uma página por <Image> (pg_N), deslizando para o lado
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
  const [currentPage, setCurrentPage] = useState(1);
  const pdfDocRef = useRef(null);
  const sliderRef = useRef(null);
  const dragRef = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const renderedPagesRef = useRef(new Set());

  const effectiveNumPages = imageMode ? numPages : rawNumPages;
  const effectiveLoading = imageMode ? imageLoading : rawLoading;
  const effectiveError = imageMode ? imageError : rawError;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < effectiveNumPages;

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
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/scripts/pdf.worker.min.mjs";

        // Proxy via API route para evitar bloqueio de CSP em produção.
        // O pdfjs-dist faz fetch() do PDF, e o CSP connect-src só permite
        // 'self' e api.cloudinary.com — não res.cloudinary.com (raw uploads).
        const proxyUrl = pdfUrl.includes("res.cloudinary.com") ? `/api/v1/pdf-proxy?url=${encodeURIComponent(pdfUrl)}` : pdfUrl;

        const pdf = await pdfjsLib.getDocument({
          url: proxyUrl,
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

  // ── Modo raw: renderiza cada página sob demanda (lazy) no slide ──
  useEffect(() => {
    if (imageMode || !pdfDocRef.current || rawNumPages === 0) return;

    const slider = sliderRef.current;
    if (!slider) return;

    const rendered = renderedPagesRef.current;

    async function renderPage(pageNum, container) {
      if (rendered.has(pageNum)) return;
      rendered.add(pageNum);

      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const scale = Math.min(containerWidth / baseViewport.width, containerHeight / baseViewport.height);

        const canvas = document.createElement("canvas");
        canvas.className = styles.rawPageCanvas;
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        container.innerHTML = "";
        container.appendChild(canvas);

        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;
      } catch (err) {
        rendered.delete(pageNum);
        console.error(`Erro ao renderizar página ${pageNum}:`, err);
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            renderPage(Number.parseInt(entry.target.dataset.page, 10), entry.target);
          }
        }
      },
      { root: slider, rootMargin: "100% 0px" },
    );

    const slides = slider.querySelectorAll(`.${styles.rawSlide}`);
    for (const slide of slides) {
      observer.observe(slide);
    }

    return () => observer.disconnect();
  }, [imageMode, rawNumPages]);

  const scrollToPage = useCallback(
    (page) => {
      const slider = sliderRef.current;
      if (!slider) return;
      const target = Math.min(Math.max(page, 1), effectiveNumPages || 1);
      slider.scrollTo({ left: (target - 1) * slider.clientWidth, behavior: "smooth" });
      setCurrentPage(target);
    },
    [effectiveNumPages],
  );

  const goNext = useCallback(() => {
    if (!hasNext) return;
    scrollToPage(currentPage + 1);
  }, [hasNext, currentPage, scrollToPage]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    scrollToPage(currentPage - 1);
  }, [hasPrev, currentPage, scrollToPage]);

  // Mantém o indicador de página sincronizado com o scroll
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    function onScroll() {
      const page = Math.round(slider.scrollLeft / slider.clientWidth) + 1;
      setCurrentPage((prev) => (prev === page ? prev : page));
    }

    slider.addEventListener("scroll", onScroll, { passive: true });
    return () => slider.removeEventListener("scroll", onScroll);
  }, [effectiveNumPages]);

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

  // Arrastar para navegar (mouse) + clique nas laterais
  const onPointerDown = useCallback((e) => {
    if (e.pointerType !== "mouse") return;
    const slider = sliderRef.current;
    if (!slider) return;
    dragRef.current = { down: true, startX: e.clientX, startScroll: slider.scrollLeft, moved: false };
    slider.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag.down) return;
    const slider = sliderRef.current;
    if (!slider) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 4) drag.moved = true;
    slider.scrollLeft = drag.startScroll - dx;
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag.down) return;
      drag.down = false;

      const slider = sliderRef.current;
      if (!slider) return;

      if (!drag.moved) {
        const rect = slider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width / 3) goPrev();
        else if (x > (rect.width * 2) / 3) goNext();
      }
    },
    [goPrev, goNext],
  );

  const pageIndicator = effectiveNumPages > 0 ? `Página ${currentPage} de ${effectiveNumPages}` : "";

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

          {!effectiveLoading && !effectiveError && effectiveNumPages > 0 && (
            <>
              <div
                ref={sliderRef}
                className={styles.slider}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  dragRef.current.down = false;
                }}
              >
                {Array.from({ length: effectiveNumPages }, (_, i) => {
                  const page = i + 1;
                  if (imageMode) {
                    return (
                      <div key={page} className={styles.slide}>
                        <Image
                          src={pageImageUrl(pdfUrl, page)}
                          alt={`Página ${page}`}
                          fill
                          unoptimized
                          priority={page === 1}
                          className={styles.slideImg}
                        />
                        <span className={styles.pageLabel}>Página {page}</span>
                      </div>
                    );
                  }
                  return <div key={page} className={`${styles.slide} ${styles.rawSlide}`} data-page={page} />;
                })}
              </div>

              <button
                type="button"
                className={`${styles.navBtn} ${styles.navLeft}`}
                onClick={goPrev}
                disabled={!hasPrev}
                aria-label="Página anterior"
              >
                ‹
              </button>

              <button
                type="button"
                className={`${styles.navBtn} ${styles.navRight}`}
                onClick={goNext}
                disabled={!hasNext}
                aria-label="Próxima página"
              >
                ›
              </button>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>� Arraste ou clique nas laterais</span>
          <span className={styles.footerDot} />
          <span className={styles.footerHint}>← → Teclado</span>
          <span className={styles.footerDot} />
          <span className={styles.footerHint}>Esc Fechar</span>
        </div>
      </div>
    </div>
  );
}
