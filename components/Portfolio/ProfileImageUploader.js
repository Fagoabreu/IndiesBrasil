import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Avatar, IconButton } from "@primer/react";
import { PencilIcon } from "@primer/octicons-react";
import styles from "./ProfileImageUploader.module.css";
import ImageCropModal from "@/components/ImageTools/ImageCropTool/ImageCropModal";

export default function ProfileImageUploader({
  endpoint,
  onUploaded,
  disabled,
  label = "Alterar imagem",
  type = "avatar", // avatar | cover
  withCrop = false,
}) {
  const inputRef = useRef(null);

  // Shared state
  const [loading, setLoading] = useState(false);

  // withCrop flow
  const [cropSrc, setCropSrc] = useState(null); // data URL fed to modal

  // plain preview flow (withCrop=false)
  const [previewUrl, setPreviewUrl] = useState(null);
  const [file, setFile] = useState(null);

  function openFileDialog() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    // Reset input so the same file can be re-selected after cancel
    event.target.value = "";

    if (withCrop || type === "cover") {
      const reader = new FileReader();
      reader.onload = () => setCropSrc(reader.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  }

  // ── withCrop flow ──────────────────────────────────────
  function handleCropClose() {
    setCropSrc(null);
  }

  async function handleCropConfirm(blob) {
    setCropSrc(null);
    await uploadBlob(blob);
  }

  // ── plain flow ─────────────────────────────────────────
  function cancelPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
  }

  async function confirmUpload() {
    if (!file) return;
    await uploadBlob(file);
    cancelPreview();
  }

  // ── shared upload ──────────────────────────────────────
  async function uploadBlob(data) {
    const formData = new FormData();
    formData.append("file", data);
    formData.append(
      "imgType",
      type === "cover" ? "background_image" : "avatar_image",
    );
    setLoading(true);
    await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    setLoading(false);
    if (onUploaded) await onUploaded();
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      {/* Crop modal (withCrop flow) */}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          preset={type === "cover" ? "profileBanner" : "avatar"}
          onConfirm={handleCropConfirm}
          onClose={handleCropClose}
        />
      )}

      {/* Trigger button */}
      {!previewUrl && type === "cover" && (
        <Button
          size="small"
          variant="primary"
          onClick={openFileDialog}
          disabled={disabled || loading}
        >
          {label}
        </Button>
      )}

      {!previewUrl && type !== "cover" && (
        <IconButton
          icon={PencilIcon}
          size="small"
          variant="primary"
          aria-label={label}
          onClick={openFileDialog}
          disabled={disabled || loading}
        />
      )}

      {/* Plain preview (withCrop=false) */}
      {previewUrl && (
        <div className={styles.previewContainer}>
          {type === "avatar" ? (
            <Avatar size={96} src={previewUrl} />
          ) : (
            <div
              className={styles.coverPreview}
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          )}

          <div className={styles.actions}>
            <Button
              size="small"
              variant="primary"
              loading={loading}
              onClick={confirmUpload}
            >
              Confirmar
            </Button>
            <Button
              size="small"
              variant="invisible"
              onClick={cancelPreview}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

ProfileImageUploader.propTypes = {
  endpoint: PropTypes.string.isRequired,
  onUploaded: PropTypes.func,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  type: PropTypes.oneOf(["avatar", "cover"]),
  withCrop: PropTypes.bool,
};
