import SeoHead from "@/components/SeoHead";
import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@primer/react";
import Image from "next/image";

import styles from "./imagecrop.module.css";
import { generateImage } from "@/utils/ImageUtils";
import { SITE_URL } from "@/lib/seo";

const PAGE_TITLE = "Editor e Recorte de Imagem Online Grátis | Indies Brasil";
const PAGE_DESCRIPTION =
  "Recorte, redimensione, ajuste brilho, contraste e saturação de imagens online. Exporte em PNG, JPG ou WebP. Sem cadastro, grátis e direto no navegador.";
const PAGE_URL = `${SITE_URL}/ferramentas/imagecrop`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Editor de Imagem — Indies Brasil",
  url: PAGE_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  featureList: "recortar imagem, ajuste de brilho, contraste, saturação, exportar PNG JPG WebP",
};

export default function FerramentasPage() {
  const [isProcessing, setIsProcessing] = useState(false);

  const [imageSrc, setImageSrc] = useState(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [aspect, setAspect] = useState(1);
  const [shape, setShape] = useState(0);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const [format, setFormat] = useState("image/png");

  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [preview, setPreview] = useState(null);
  const [fileSize, setFileSize] = useState(null);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function reset() {
    setZoom(1);
    setRotation(0);
    setShape(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  }

  async function handleFile(event) {
    if (!event.target.files?.length) return;

    const reader = new FileReader();

    reader.onload = () => {
      setImageSrc(reader.result);
      setPreview(null);
    };

    reader.readAsDataURL(event.target.files[0]);
  }

  const renderPreview = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);

    const result = await generateImage({
      imageSrc,
      crop: croppedAreaPixels,
      rotation,
      shape,
      brightness,
      contrast,
      saturation,
      format,
    });

    setPreview(result.url);
    setFileSize(result.size);
    setIsProcessing(false);
  }, [imageSrc, croppedAreaPixels, rotation, shape, brightness, contrast, saturation, format]);

  useEffect(() => {
    const timer = setTimeout(() => {
      renderPreview();
    }, 120);

    return () => clearTimeout(timer);
  }, [renderPreview]);

  function presetAvatar() {
    setAspect(1);
    setShape(100);
  }

  function presetThumbnail() {
    setAspect(1);
    setShape(0);
  }

  function presetBanner() {
    setAspect(16 / 9);
    setShape(0);
  }

  return (
    <div className={styles.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      {/* Page header */}
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Editor de Imagem</h1>
        <p className={styles.pageSubtitle}>Recorte, ajuste e exporte imagens para qualquer formato.</p>
      </header>

      {/* File input */}
      <div className={styles.fileInputWrapper}>
        <label className={styles.fileLabel}>
          📁 Escolher imagem
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
        {imageSrc && <span style={{ fontSize: 13, color: "var(--fgColor-muted)" }}>Imagem carregada</span>}
      </div>

      {imageSrc && (
        <>
          <div className={styles.cropContainer}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={shape === 100 ? "round" : "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className={styles.presets}>
            <Button onClick={presetAvatar}>Avatar</Button>
            <Button onClick={presetThumbnail}>Thumbnail</Button>
            <Button onClick={presetBanner}>Banner</Button>
          </div>

          <div className={styles.controls}>
            <label>
              Zoom ({zoom.toFixed(1)})
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>

            <label>
              Rotação ({rotation}°)
              <input type="range" min={0} max={360} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />
            </label>

            <label>
              Shape ({shape}%)
              <input type="range" min={0} max={100} value={shape} onChange={(e) => setShape(Number(e.target.value))} />
            </label>

            <label>
              Brightness ({brightness}%)
              <input type="range" min={0} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
            </label>

            <label>
              Contrast ({contrast}%)
              <input type="range" min={0} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
            </label>

            <label>
              Saturation ({saturation}%)
              <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} />
            </label>

            <label>
              Formato
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WEBP</option>
              </select>
            </label>
            <Button onClick={reset}>Reset</Button>
          </div>
        </>
      )}

      {preview && (
        <div className={styles.preview}>
          <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Preview</h3>

          <Image src={preview} alt="preview" unoptimized width={300} height={Math.round(300 / aspect)} />

          {isProcessing ? <span>Atualizando preview...</span> : <span>Tamanho: {fileSize} KB</span>}

          <Button as="a" href={preview} download="imagem-editada">
            Download
          </Button>
        </div>
      )}
    </div>
  );
}
