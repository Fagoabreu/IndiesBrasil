import SeoHead from "@/components/SeoHead";
import styles from "./imagens-para-pdf.module.css";
import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { SITE_URL } from "@/lib/seo";

const PAGE_TITLE = "Converter Imagens em PDF Grátis Online | Indies Brasil";
const PAGE_DESCRIPTION =
  "Converta múltiplas imagens em um único PDF ou comprima PDFs existentes. Controle qualidade e resolução. Grátis, sem cadastro e sem armazenamento.";
const PAGE_URL = `${SITE_URL}/ferramentas/imagens-para-pdf`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Imagens para PDF — Indies Brasil",
  url: PAGE_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
};

const MAX_FILES = 100;
const IMAGE_ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];
const PDF_ACCEPTED = ["application/pdf"];

const QUALITY_PRESETS = [
  { label: "Máxima compressão", value: 0.4 },
  { label: "Alta compressão", value: 0.55 },
  { label: "Equilibrado", value: 0.75 },
  { label: "Alta qualidade", value: 0.85 },
  { label: "Máxima qualidade", value: 0.92 },
];

const MAX_DIM_OPTIONS = [
  { label: "Original", value: 0 },
  { label: "2480px (A4 @300dpi)", value: 2480 },
  { label: "1920px (Full HD)", value: 1920 },
  { label: "1440px", value: 1440 },
  { label: "1024px", value: 1024 },
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function downscaleCanvas(canvas, maxDim) {
  if (!maxDim) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const largest = Math.max(w, h);
  if (largest <= maxDim) return canvas;
  const scale = maxDim / largest;
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/**
 * Convert an image file to JPEG blob with configurable quality and max dimension.
 */
function fileToJpegBlob(file, quality, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas = downscaleCanvas(canvas, maxDim);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const jpgName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], jpgName, { type: "image/jpeg" }));
          } else {
            reject(new Error(`Falha ao converter "${file.name}"`));
          }
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Não foi possível carregar "${file.name}"`));
    };

    img.src = objectUrl;
  });
}

/**
 * Render one page of a PDF to a canvas using pdfjs-dist.
 */
async function renderPdfPageToCanvas(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ImagensParaPdf() {
  const [tab, setTab] = useState("images");
  const [quality, setQuality] = useState(0.75);
  const [maxDim, setMaxDim] = useState(0);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  // ── Images tab ──
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  // ── Compress tab ──
  const pdfInputRef = useRef(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);

  // ── Estimated output size ──
  const totalOriginalBytes = sortedFiles.reduce((sum, f) => sum + f.size, 0);
  const totalJpegBytes = pdfFile ? pdfFile.size : totalOriginalBytes;
  const estimQualityFactor = quality / 0.92;
  const estimDownscaleFactor = maxDim && totalJpegBytes > 0 ? Math.min(1, (maxDim * maxDim) / (4000 * 4000)) : 1;
  const estimatedBytes = Math.round(totalJpegBytes * estimQualityFactor * Math.max(estimDownscaleFactor, 0.2));

  // ── Images tab handlers ──
  const handleFiles = useCallback(
    (newFiles) => {
      setError("");
      const imageFiles = Array.from(newFiles).filter((f) => IMAGE_ACCEPTED.includes(f.type));
      if (imageFiles.length === 0) {
        setError("Nenhuma imagem válida encontrada. Formatos aceitos: JPEG, PNG, WebP, BMP, TIFF.");
        return;
      }
      if (imageFiles.length + files.length > MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} imagens. Você já tem ${files.length}.`);
        return;
      }
      setFiles((prev) => [...prev, ...imageFiles]);
    },
    [files.length],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e) => {
      handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles],
  );

  const removeFile = useCallback((index) => setFiles((prev) => prev.filter((_, i) => i !== index)), []);
  const clearAll = useCallback(() => {
    setFiles([]);
    setError("");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (sortedFiles.length === 0) return;
    setGenerating(true);
    setError("");
    try {
      const formData = new FormData();
      for (const file of sortedFiles) {
        const jpegFile = await fileToJpegBlob(file, quality, maxDim);
        formData.append("images", jpegFile, jpegFile.name);
      }
      const response = await fetch("/api/v1/tools/images-to-pdf", { method: "POST", body: formData });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Erro ao gerar o PDF.");
      }
      const blob = await response.blob();
      downloadBlob(blob, "imagens-para-pdf.pdf");
    } catch (err) {
      setError(err.message || "Erro inesperado ao gerar o PDF.");
    } finally {
      setGenerating(false);
    }
  }, [sortedFiles, quality, maxDim]);

  // ── Compress tab handlers ──
  const handlePdfDrop = useCallback(
    (e) => {
      e.preventDefault();
      setPdfDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      const pdf = dropped.find((f) => f.type === "application/pdf");
      if (pdf) {
        setError("");
        setPdfFile(pdf);
        setPdfPageCount(0);
      } else {
        setError("Arraste um arquivo PDF válido.");
      }
    },
    [setPdfDragOver, setError, setPdfFile, setPdfPageCount],
  );

  const handlePdfInputChange = useCallback(
    (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f && f.type === "application/pdf") {
        setError("");
        setPdfFile(f);
        setPdfPageCount(0);
      }
    },
    [setError, setPdfFile, setPdfPageCount],
  );

  const handleCompress = useCallback(async () => {
    if (!pdfFile) return;
    setGenerating(true);
    setError("");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      setPdfPageCount(totalPages);

      const formData = new FormData();
      for (let i = 1; i <= totalPages; i++) {
        const canvas = await renderPdfPageToCanvas(pdf, i);
        const scaled = downscaleCanvas(canvas, maxDim);
        const blob = await new Promise((resolve, reject) => {
          scaled.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao renderizar página " + i))), "image/jpeg", quality);
        });
        formData.append("images", new File([blob], `pagina-${String(i).padStart(4, "0")}.jpg`, { type: "image/jpeg" }));
      }

      const response = await fetch("/api/v1/tools/images-to-pdf", { method: "POST", body: formData });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Erro ao comprimir o PDF.");
      }
      const blob = await response.blob();
      const originalName = pdfFile.name.replace(/\.pdf$/i, "");
      downloadBlob(blob, `${originalName}-comprimido.pdf`);
    } catch (err) {
      setError(err.message || "Erro inesperado ao comprimir o PDF.");
    } finally {
      setGenerating(false);
    }
  }, [pdfFile, quality, maxDim, setGenerating, setError, setPdfPageCount]);

  const clearPdf = useCallback(() => {
    setPdfFile(null);
    setPdfPageCount(0);
    setError("");
  }, [setPdfFile, setPdfPageCount, setError]);

  // ── Quality label ──
  let qualityLabel = "";
  if (quality <= 0.5) qualityLabel = " (compacto)";
  else if (quality <= 0.7) qualityLabel = " (bom)";
  else if (quality <= 0.82) qualityLabel = " (ótimo)";
  else qualityLabel = " (máximo)";

  return (
    <main className={styles.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      <section className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Imagens para <span>PDF</span>
        </h1>
        <p className={styles.pageSubtitle}>Converta imagens em PDF ou comprima PDFs existentes. Controle qualidade e resolução. Nada é armazenado.</p>
      </section>

      {/* ---- Tabs ---- */}
      <nav className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "images"}
          className={`${styles.tab} ${tab === "images" ? styles.tabActive : ""}`}
          onClick={() => setTab("images")}
        >
          Imagens → PDF
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "compress"}
          className={`${styles.tab} ${tab === "compress" ? styles.tabActive : ""}`}
          onClick={() => setTab("compress")}
        >
          Comprimir PDF
        </button>
      </nav>

      {/* ---- Quality controls ---- */}
      <section className={styles.controls} role="region" aria-label="Opções de qualidade">
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>
            Qualidade: {Math.round(quality * 100)}%{qualityLabel}
          </label>
          <div className={styles.sliderRow}>
            <span className={styles.sliderExtreme}>Compacto</span>
            <input
              type="range"
              min="0.4"
              max="0.92"
              step="0.01"
              value={quality}
              onChange={(e) => setQuality(Number.parseFloat(e.target.value))}
              className={styles.slider}
              aria-label="Qualidade da imagem"
            />
            <span className={styles.sliderExtreme}>Máximo</span>
          </div>
          <div className={styles.sliderPresets}>
            {QUALITY_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`${styles.presetBtn} ${quality === p.value ? styles.presetBtnActive : ""}`}
                onClick={() => setQuality(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Dimensão máxima</label>
          <div className={styles.dimOptions}>
            {MAX_DIM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.dimBtn} ${maxDim === opt.value ? styles.dimBtnActive : ""}`}
                onClick={() => setMaxDim(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {totalJpegBytes > 0 && (
          <div className={styles.estimate}>
            Tamanho original: <strong>{formatBytes(totalJpegBytes)}</strong> → estimado: <strong>{formatBytes(estimatedBytes)}</strong> (
            {estimatedBytes < totalJpegBytes ? `${Math.round((1 - estimatedBytes / totalJpegBytes) * 100)}% menor` : "sem alteração significativa"})
          </div>
        )}
      </section>

      {/* ---- Error ---- */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {/* ========== TAB: Imagens → PDF ========== */}
      {tab === "images" && (
        <>
          <section
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ""}`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Clique ou arraste imagens para fazer upload"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPTED.join(",")}
              multiple
              onChange={handleInputChange}
              className={styles.fileInput}
            />
            <div className={styles.dropZoneIcon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <p className={styles.dropZoneTitle}>
              Arraste suas imagens aqui ou <span>clique para selecionar</span>
            </p>
            <p className={styles.dropZoneHint}>JPEG, PNG, WebP, BMP, TIFF — até {MAX_FILES} imagens</p>
          </section>

          {sortedFiles.length > 0 && (
            <section className={styles.previewSection}>
              <div className={styles.previewHeader}>
                <h2 className={styles.previewTitle}>
                  {sortedFiles.length} {sortedFiles.length === 1 ? "imagem" : "imagens"} — ordenadas A-Z
                </h2>
                <button type="button" className={styles.btnClear} onClick={clearAll} disabled={generating}>
                  Limpar tudo
                </button>
              </div>
              <div className={styles.previewGrid}>
                {sortedFiles.map((file, sortedIdx) => {
                  const originalIdx = files.indexOf(file);
                  return (
                    <div key={`${file.name}-${originalIdx}`} className={styles.previewCard}>
                      <div className={styles.previewNumber}>{sortedIdx + 1}</div>
                      <button
                        type="button"
                        className={styles.previewRemove}
                        onClick={() => removeFile(originalIdx)}
                        disabled={generating}
                        aria-label={`Remover ${file.name}`}
                      >
                        &times;
                      </button>
                      <div className={styles.previewImageWrapper}>
                        <Image src={URL.createObjectURL(file)} alt={file.name} fill unoptimized className={styles.previewImage} />
                      </div>
                      <p className={styles.previewName} title={file.name}>
                        {file.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {sortedFiles.length > 0 && (
            <section className={styles.actions}>
              <button type="button" className={styles.btnGenerate} onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <span className={styles.spinner} />
                    Gerando PDF…
                  </>
                ) : (
                  "Gerar PDF"
                )}
              </button>
            </section>
          )}
        </>
      )}

      {/* ========== TAB: Comprimir PDF ========== */}
      {tab === "compress" && (
        <>
          {!pdfFile ? (
            <section
              className={`${styles.dropZone} ${pdfDragOver ? styles.dropZoneActive : ""}`}
              onDrop={handlePdfDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setPdfDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setPdfDragOver(false);
              }}
              onClick={() => pdfInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Clique ou arraste um PDF para comprimir"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") pdfInputRef.current?.click();
              }}
            >
              <input ref={pdfInputRef} type="file" accept={PDF_ACCEPTED.join(",")} onChange={handlePdfInputChange} className={styles.fileInput} />
              <div className={styles.dropZoneIcon}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <p className={styles.dropZoneTitle}>
                Arraste um PDF aqui ou <span>clique para selecionar</span>
              </p>
              <p className={styles.dropZoneHint}>Arquivos PDF de qualquer tamanho</p>
            </section>
          ) : (
            <section className={styles.pdfInfo}>
              <div className={styles.pdfInfoIcon}>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className={styles.pdfInfoDetails}>
                <p className={styles.pdfInfoName}>{pdfFile.name}</p>
                <p className={styles.pdfInfoMeta}>
                  {formatBytes(pdfFile.size)}
                  {pdfPageCount > 0 && ` — ${pdfPageCount} ${pdfPageCount === 1 ? "página" : "páginas"}`}
                </p>
              </div>
              <button type="button" className={styles.btnClear} onClick={clearPdf} disabled={generating}>
                Remover
              </button>
            </section>
          )}

          {pdfFile && (
            <section className={styles.actions}>
              <button type="button" className={styles.btnGenerate} onClick={handleCompress} disabled={generating}>
                {generating ? (
                  <>
                    <span className={styles.spinner} />
                    Comprimindo PDF…
                  </>
                ) : (
                  "Comprimir PDF"
                )}
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
