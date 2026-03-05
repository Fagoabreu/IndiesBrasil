import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { Button, Heading } from "@primer/react";

import styles from "./imagecrop.module.css";
import { generateImage } from "@/utils/ImageUtils";

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
      <Heading as="h1">Editor de Imagem</Heading>

      <input type="file" accept="image/*" onChange={handleFile} />

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
            <Button onClick={reset} href={preview} download="imagem-editada">
              Reset
            </Button>
          </div>
        </>
      )}

      {preview && (
        <div className={styles.preview}>
          <Heading as="h3">Preview</Heading>

          <img src={preview} alt="preview" />

          {isProcessing ? <span>Atualizando preview...</span> : <span>Tamanho: {fileSize} KB</span>}

          <Button as="a" href={preview} download="imagem-editada">
            Download
          </Button>
        </div>
      )}
    </div>
  );
}
