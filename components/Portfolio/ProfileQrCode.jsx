import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { QRCodeCanvas } from "qrcode.react";
import { PencilIcon, DownloadIcon } from "@primer/octicons-react";
import { IconButton } from "@primer/react";
import QrCodeModal from "@/components/QrCode/QrCodeModal";
import { DEFAULT_QR_SETTINGS } from "@/components/QrCode/QrCodeCustomizer";
import { SITE_URL } from "@/lib/seo";
import styles from "./ProfileQrCode.module.css";

function getStoredSettings(username) {
  try {
    const raw = localStorage.getItem(`qr_settings_${username}`);
    return raw ? { ...DEFAULT_QR_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_QR_SETTINGS };
  } catch {
    return { ...DEFAULT_QR_SETTINGS };
  }
}

function storeSettings(username, settings) {
  try {
    localStorage.setItem(`qr_settings_${username}`, JSON.stringify(settings));
  } catch {
    // silently ignore storage errors
  }
}

/**
 * Exibe o QR Code do perfil com botão de download.
 * Se isOwnProfile, exibe também o botão de edição que abre o QrCodeModal.
 *
 * @param {string}  username      - Nome de usuário para montar a URL e chave de storage
 * @param {boolean} isOwnProfile  - Se verdadeiro, exibe botão de edição
 */
export default function ProfileQrCode({ username, isOwnProfile }) {
  const [settings, setSettings] = useState(() => {
    if (globalThis.window !== undefined && username) {
      return getStoredSettings(username);
    }
    return { ...DEFAULT_QR_SETTINGS };
  });
  const [modalOpen, setModalOpen] = useState(false);
  const qrRef = useRef(null);

  const profileUrl = `${SITE_URL}/perfil/${username}`;

  function handleSave(newSettings) {
    setSettings(newSettings);
    storeSettings(username, newSettings);
    setModalOpen(false);
  }

  function handleDownload() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `qr-${username}.png`;
    link.click();
  }

  if (!username) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.qrBox} ref={qrRef}>
        <QRCodeCanvas
          value={profileUrl}
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
        {isOwnProfile && (
          <IconButton icon={PencilIcon} aria-label="Editar QR Code" size="small" variant="invisible" onClick={() => setModalOpen(true)} />
        )}
      </div>

      {modalOpen && <QrCodeModal value={profileUrl} initialSettings={settings} onSave={handleSave} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

ProfileQrCode.propTypes = {
  username: PropTypes.string,
  isOwnProfile: PropTypes.bool,
};
