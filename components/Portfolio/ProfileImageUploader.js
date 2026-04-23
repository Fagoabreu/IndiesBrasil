import { useRef, useState } from "react";
import { Button, Avatar } from "@primer/react";
import styles from "./ProfileImageUploader.module.css";

export default function ProfileImageUploader({
  endpoint,
  onUploaded,
  disabled,
  label = "Alterar imagem",
  type = "avatar", // avatar | cover
}) {
  const inputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  function openFileDialog() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const localUrl = URL.createObjectURL(selectedFile);

    setFile(selectedFile);
    setPreviewUrl(localUrl);
  }

  function cancelPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setFile(null);
  }

  async function confirmUpload() {
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setLoading(true);

    await fetch(endpoint, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    });

    setLoading(false);

    cancelPreview();

    if (onUploaded) {
      await onUploaded();
    }
  }

  return (
    <div className={styles.wrapper}>
      <input ref={inputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleFileChange} />

      {!previewUrl && (
        <Button size="small" variant="outline" onClick={openFileDialog} disabled={disabled}>
          {label}
        </Button>
      )}

      {previewUrl && (
        <div className={styles.previewContainer}>
          {type === "avatar" ? (
            <Avatar size={96} src={previewUrl} />
          ) : (
            <div className={styles.coverPreview} style={{ backgroundImage: `url(${previewUrl})` }} />
          )}

          <div className={styles.actions}>
            <Button size="small" variant="primary" loading={loading} onClick={confirmUpload}>
              Confirmar
            </Button>

            <Button size="small" variant="invisible" onClick={cancelPreview} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
