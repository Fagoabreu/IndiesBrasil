"use client";
import { useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import ImageUploader from "@/components/ImageTools/ImageUploader/ImageUploader";
import formStyles from "./EventForm.module.css";
import styles from "./EventBannerField.module.css";

/**
 * Estado inicial do banner — nada pendente, mantendo o que já está salvo.
 *
 * Os três fluxos (arquivo recortado, link externo, remover) cabem num único
 * objeto em vez de três estados soltos, o que deixa explícito qual é a ação
 * que o submit precisa executar.
 */
export const EMPTY_BANNER = Object.freeze({
  action: "unchanged", // unchanged | upload | external | removed
  file: null,
  previewUrl: null,
  externalUrl: "",
});

/** URL que deve aparecer no preview enquanto há algo pendente. */
function pendingPreviewUrl(value) {
  if (value.action === "upload") return value.previewUrl;
  if (value.action === "external") return value.externalUrl;
  return null;
}

const bannerPropType = PropTypes.shape({
  action: PropTypes.oneOf(["unchanged", "upload", "external", "removed"]).isRequired,
  file: PropTypes.instanceOf(File),
  previewUrl: PropTypes.string,
  externalUrl: PropTypes.string,
});

/**
 * Campo de imagem de capa do evento, compartilhado por criação e edição.
 *
 * O arquivo escolhido passa pelo `ImageUploader` no preset `eventBanner`, que
 * é a proporção exata do hero da página do evento — sem isso a imagem subia
 * inteira e o `object-fit: cover` cortava as laterais.
 *
 * O componente é controlado: `value`/`onChange` carregam a ação pendente e o
 * upload em si fica com a página, porque a rota do banner exige um evento que
 * já exista (na criação o evento só nasce no submit).
 */
export default function EventBannerField({ value, onChange, savedUrl, disabled = false }) {
  const [mode, setMode] = useState(value.action === "external" ? "url" : null);

  /** Resultado do recorte (ImageUploader) — fica pendente até o submit. */
  function handleCropConfirm({ blob, dataUrl }) {
    setMode("upload");
    onChange({ action: "upload", file: blob, previewUrl: dataUrl, externalUrl: "" });
  }

  function handleExternalUrlChange(externalUrl) {
    const trimmed = externalUrl.trim();
    onChange({
      // Campo esvaziado volta a significar "nada pendente" em vez de "aplique
      // uma URL vazia".
      action: trimmed ? "external" : "unchanged",
      file: null,
      previewUrl: null,
      externalUrl,
    });
  }

  function handleRemove() {
    // Sem nada salvo no servidor não há o que apagar — só limpar a seleção.
    onChange(savedUrl ? { action: "removed", file: null, previewUrl: null, externalUrl: "" } : { ...EMPTY_BANNER });
  }

  const previewUrl = pendingPreviewUrl(value);
  const shownUrl = value.action === "removed" ? null : (previewUrl ?? savedUrl);
  const hasPendingUrl = value.action === "external" && Boolean(value.externalUrl.trim());

  return (
    <>
      {shownUrl && (
        <div className={styles.bannerPreviewWrap}>
          <Image
            src={shownUrl}
            alt="Pré-visualização da capa do evento"
            fill
            sizes="700px"
            className={styles.bannerImg}
            unoptimized={shownUrl.startsWith("blob:") || shownUrl.startsWith("data:")}
          />
          <button type="button" className={styles.removeBannerBtn} onClick={handleRemove} disabled={disabled}>
            Remover
          </button>
        </div>
      )}

      <div className={styles.bannerModeToggle}>
        <ImageUploader preset="eventBanner" onCropped={handleCropConfirm} disabled={disabled}>
          {({ open, disabled: uploaderDisabled }) => (
            <button
              type="button"
              className={[styles.bannerModeBtn, mode === "upload" ? styles.bannerModeBtnActive : ""].filter(Boolean).join(" ")}
              onClick={() => {
                setMode("upload");
                open();
              }}
              disabled={uploaderDisabled}
            >
              Upload de arquivo
            </button>
          )}
        </ImageUploader>
        <button
          type="button"
          className={[styles.bannerModeBtn, mode === "url" ? styles.bannerModeBtnActive : ""].filter(Boolean).join(" ")}
          onClick={() => setMode("url")}
          disabled={disabled}
        >
          Link externo
        </button>
      </div>

      {mode === "url" && (
        <input
          type="url"
          className={`${formStyles.input} ${styles.bannerUrlInput}`}
          value={value.externalUrl}
          onChange={(e) => handleExternalUrlChange(e.target.value)}
          placeholder="https://exemplo.com/imagem.jpg"
          disabled={disabled}
          aria-label="URL da imagem de capa"
        />
      )}

      {hasPendingUrl && <span className={styles.bannerUrlNote}>A imagem do link não passa por recorte — ela é usada como está.</span>}
    </>
  );
}

EventBannerField.propTypes = {
  value: bannerPropType.isRequired,
  onChange: PropTypes.func.isRequired,
  /** Banner já salvo no servidor, mostrado enquanto nada está pendente. */
  savedUrl: PropTypes.string,
  disabled: PropTypes.bool,
};
