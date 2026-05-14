import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, Avatar } from "@primer/react";
import PropTypes from "prop-types";
import Image from "next/image";

import styles from "./ImageCropModal.module.css";
import { generateImage } from "@/utils/ImageUtils";

const PRESETS = {
  avatar: { aspect: 1, shape: 100, label: "Avatar" },
  cover: { aspect: 3, shape: 0, label: "Capa" },
  banner: { aspect: 16 / 9, shape: 0, label: "Banner" },
  thumbnail: { aspect: 1, shape: 0, label: "Thumbnail" },
};

export default function ImageCropModal({ imageSrc, preset = "avatar", onConfirm, onClose }) {
  const { aspect: initialAspect, shape: initialShape } = PRESETS[preset] ?? PRESETS.avatar;
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
        shape: initialShape,
        format: "image/png",
      });
      setPreview(result.url);
    }, 150);

    return () => clearTimeout(timer);
  }, [imageSrc, croppedAreaPixels, rotation, initialShape]);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setLoading(true);

    const result = await generateImage({
      imageSrc,
      crop: croppedAreaPixels,
      rotation,
      shape: initialShape,
      format: "image/png",
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
        { buttonType: "default", content: "Cancelar", onClick: onClose, disabled: loading },
        { buttonType: "primary", content: "Confirmar recorte", onClick: handleConfirm, loading, disabled: loading },
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
            aspect={initialAspect}
            cropShape={initialShape === 100 ? "round" : "rect"}
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
              min={1}
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
            {initialShape === 100 ? (
              <Avatar src={preview} size={80} />
            ) : (
              <Image
                src={preview}
                alt="pré-visualização"
                unoptimized
                width={200}
                height={Math.round(200 / initialAspect)}
                className={styles.previewImage}
              />
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

ImageCropModal.propTypes = {
  imageSrc: PropTypes.string.isRequired,
  preset: PropTypes.oneOf(["avatar", "cover", "banner", "thumbnail"]),
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
