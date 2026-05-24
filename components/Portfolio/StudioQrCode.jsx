import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { QRCodeCanvas } from "qrcode.react";
import { PencilIcon, DownloadIcon } from "@primer/octicons-react";
import { IconButton } from "@primer/react";
import QrCodeModal from "@/components/QrCode/QrCodeModal";
import { DEFAULT_QR_SETTINGS } from "@/components/QrCode/QrCodeCustomizer";
import { SITE_URL } from "@/lib/seo";
import styles from "./ProfileQrCode.module.css";

function getStoredSettings(slug) {
  try {
    const raw = localStorage.getItem(`qr_settings_studio_${slug}`);
    return raw ? { ...DEFAULT_QR_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_QR_SETTINGS };
  } catch {
    return { ...DEFAULT_QR_SETTINGS };
  }
}

function storeSettings(slug, settings) {
  try {
    localStorage.setItem(`qr_settings_studio_${slug}`, JSON.stringify(settings));
  } catch {
    // silently ignore storage errors
  }
}

export default function StudioQrCode({ slug, canEdit }) {
  const [settings, setSettings] = useState(() => {
    if (globalThis.window !== undefined && slug) {
      return getStoredSettings(slug);
    }
    return { ...DEFAULT_QR_SETTINGS };
  });
  const [modalOpen, setModalOpen] = useState(false);
  const qrRef = useRef(null);

  const studioUrl = `${SITE_URL}/estudios/${slug}`;

  function handleSave(newSettings) {
    setSettings(newSettings);
    storeSettings(slug, newSettings);
    setModalOpen(false);
  }

  function handleDownload() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `qr-estudio-${slug}.png`;
    link.click();
  }

  if (!slug) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.qrBox} ref={qrRef}>
        <QRCodeCanvas
          value={studioUrl}
          size={120}
          fgColor={settings.fgColor}
          bgColor={settings.bgColor}
          level="M"
          imageSettings={{
            src: settings.logoURL,
            height: settings.logoSize,
            width: settings.logoSize,
            opacity: 1,
            excavate: true,
            crossOrigin: "anonymous",
          }}
        />
      </div>

      <div className={styles.actions}>
        <IconButton icon={DownloadIcon} aria-label="Baixar QR Code" size="small" variant="invisible" onClick={handleDownload} />
        {canEdit && <IconButton icon={PencilIcon} aria-label="Editar QR Code" size="small" variant="invisible" onClick={() => setModalOpen(true)} />}
      </div>

      {modalOpen && <QrCodeModal value={studioUrl} initialSettings={settings} onSave={handleSave} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

StudioQrCode.propTypes = {
  slug: PropTypes.string,
  canEdit: PropTypes.bool,
};
