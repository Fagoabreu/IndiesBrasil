import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { QRCodeCanvas } from "qrcode.react";
import { PencilIcon, DownloadIcon } from "@primer/octicons-react";
import { IconButton } from "@primer/react";
import QrCodeModal from "@/components/QrCode/QrCodeModal";
import { DEFAULT_QR_SETTINGS } from "@/components/QrCode/QrCodeCustomizer";
import { SITE_URL } from "@/lib/seo";
import styles from "./ProfileQrCode.module.css";

function dbSettingsToState(data) {
  return {
    fgColor: data.fg_color ?? DEFAULT_QR_SETTINGS.fgColor,
    bgColor: data.bg_color ?? DEFAULT_QR_SETTINGS.bgColor,
    logoSize: data.logo_size ?? DEFAULT_QR_SETTINGS.logoSize,
    logoURL: data.logo_url ?? DEFAULT_QR_SETTINGS.logoURL,
  };
}

export default function StudioQrCode({ slug, canEdit, size = 120 }) {
  const [settings, setSettings] = useState({ ...DEFAULT_QR_SETTINGS });
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const qrRef = useRef(null);

  const studioUrl = `${SITE_URL}/estudios/${slug}`;

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/studios/${slug}/qr-code`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSettings(dbSettingsToState(data));
      })
      .catch(() => {});
  }, [slug]);

  async function handleSave(newSettings, logoFile) {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("fg_color", newSettings.fgColor);
      formData.append("bg_color", newSettings.bgColor);
      formData.append("logo_size", String(newSettings.logoSize));
      if (logoFile) formData.append("logo_file", logoFile);

      const res = await fetch(`/api/v1/studios/${slug}/qr-code`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(dbSettingsToState(data));
      } else {
        setSettings(newSettings);
      }
    } finally {
      setSaving(false);
      setModalOpen(false);
    }
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
          size={size}
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
        {canEdit && (
          <IconButton
            icon={PencilIcon}
            aria-label="Editar QR Code"
            size="small"
            variant="invisible"
            disabled={saving}
            onClick={() => setModalOpen(true)}
          />
        )}
      </div>

      {modalOpen && <QrCodeModal value={studioUrl} initialSettings={settings} onSave={handleSave} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

StudioQrCode.propTypes = {
  slug: PropTypes.string,
  canEdit: PropTypes.bool,
  size: PropTypes.number,
};
