import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, Avatar } from "@primer/react";
import PropTypes from "prop-types";
import Image from "next/image";

import styles from "./ImageCropModal.module.css";
import { generateImage } from "@/utils/ImageUtils";
import { getImagePreset, DEFAULT_PRESET, IMAGE_PRESET_NAMES } from "@/lib/image-presets";

export default function ImageCropModal({ imageSrc, preset = DEFAULT_PRESET, onConfirm, onClose }) {
  // O catálogo é a única fonte de verdade do formato: quem recorta e quem
  // renderiza leem a mesma proporção (`lib/image-presets.js`).
  const { aspect, shape, format, quality, outputWidth } = getImagePreset(preset);
  const returnFocusRef = useRef(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // Keep preview in sync with crop area
  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels) return;

    const timer = setTimeout(async () => {
      const result = await generateImage({
        imageSrc,
        crop: croppedAreaPixels,
        rotation,
        shape,
        format,
        quality,
        outputWidth,
      });
      setPreview(result.url);
    }, 150);

    return () => clearTimeout(timer);
  }, [imageSrc, croppedAreaPixels, rotation, shape, format, quality, outputWidth]);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setLoading(true);

    const result = await generateImage({
      imageSrc,
      crop: croppedAreaPixels,
      rotation,
      shape,
      format,
      quality,
      outputWidth,
    });

    setLoading(false);
    onConfirm(result.blob);
  }

  return (
    <Dialog
      title="Recortar imagem"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      footerButtons={[
        {
          buttonType: "default",
          content: "Cancelar",
          onClick: onClose,
          disabled: loading,
        },
        {
          buttonType: "primary",
          content: "Confirmar recorte",
          onClick: handleConfirm,
          loading,
          disabled: loading,
        },
      ]}
    >
      <div className={styles.body}>
        {/* Cropper area */}
        <div className={styles.cropArea}>
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

        {/* Controls */}
        <div className={styles.controls}>
          <label className={styles.sliderLabel}>
            Zoom ({zoom.toFixed(1)}×)
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={zoom}
              className={styles.slider}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>

          <label className={styles.sliderLabel}>
            Rotação ({rotation}°)
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              className={styles.slider}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>Pré-visualização</span>
            {shape === 100 ? (
              <Avatar src={preview} size={80} />
            ) : (
              // O frame carrega a proporção do preset e a imagem o preenche:
              // antes a altura vinha calculada a partir de uma largura fixa e
              // acabava esbarrando em `max-width`/`max-height`, então o
              // preview saía numa proporção diferente da do arquivo gerado
              // (com a imagem recortada dentro dele).
              <span className={styles.previewFrame} style={{ "--preview-aspect": aspect }}>
                <Image src={preview} alt="Pré-visualização do recorte" fill unoptimized sizes="160px" className={styles.previewImage} />
              </span>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

ImageCropModal.propTypes = {
  imageSrc: PropTypes.string.isRequired,
  preset: PropTypes.oneOf(IMAGE_PRESET_NAMES),
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
