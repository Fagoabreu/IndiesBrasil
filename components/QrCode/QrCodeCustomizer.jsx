import { useRef } from "react";
import PropTypes from "prop-types";
import { QRCodeCanvas } from "qrcode.react";
import { UploadIcon } from "@primer/octicons-react";
import { Select, FormControl } from "@primer/react";
import styles from "./QrCodeCustomizer.module.css";

export const DEFAULT_QR_SETTINGS = {
  fgColor: "#000000",
  bgColor: "#ffffff",
  logoURL: "/images/logo.png",
  logoSize: 24,
};

/**
 * Componente reutilizável de customização de QR Code.
 *
 * @param {string}   value          - Valor codificado no QR (URL)
 * @param {function} onValueChange  - Callback para alterar a URL (apenas qrgen)
 * @param {object}   settings       - { fgColor, bgColor, logoURL, logoSize }
 * @param {function} onChange       - Callback com o novo objeto settings
 * @param {boolean}  showUrlInput   - Exibir campo de URL editável (qrgen)
 * @param {boolean}  showDownload   - Exibir botão de download (qrgen)
 * @param {number}   size           - Tamanho em px do canvas QR (default 200)
 */
export default function QrCodeCustomizer({
  value = "",
  onValueChange,
  settings = DEFAULT_QR_SETTINGS,
  onChange,
  showUrlInput = false,
  showDownload = false,
  size = 200,
}) {
  const qrRef = useRef(null);
  const { fgColor, bgColor, logoURL, logoSize } = settings;

  function update(key, val) {
    onChange({ ...settings, [key]: val });
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") update("logoURL", reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleDownload() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "qr-code.png";
    link.click();
  }

  return (
    <div className={styles.layout}>
      {/* Coluna esquerda: URL (opcional) + preview */}
      <div className={styles.previewCol}>
        {showUrlInput && (
          <div className={styles.urlField}>
            <label htmlFor="qr-link" className={styles.label}>
              Digite seu link:
            </label>
            <input
              type="text"
              id="qr-link"
              className={styles.urlInput}
              placeholder="Seu link aqui"
              value={value}
              onChange={(e) => onValueChange?.(e.target.value)}
            />
          </div>
        )}
        <div ref={qrRef} className={styles.canvasWrap}>
          <QRCodeCanvas
            value={value || " "}
            size={size}
            fgColor={fgColor}
            bgColor={bgColor}
            level="L"
            imageSettings={{
              src: logoURL,
              height: logoSize,
              width: logoSize,
              opacity: 1,
              excavate: true,
              crossOrigin: "anonymous",
            }}
          />
        </div>
      </div>

      {/* Coluna direita: controles */}
      <div className={styles.controlsCol}>
        {/* Cores */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Cores</p>
          <div className={styles.colorRow}>
            <FormControl>
              <FormControl.Label>Cor Principal</FormControl.Label>
              <input type="color" className={styles.colorPicker} value={fgColor} onChange={(e) => update("fgColor", e.target.value)} />
            </FormControl>
            <FormControl>
              <FormControl.Label>Cor de Fundo</FormControl.Label>
              <input type="color" className={styles.colorPicker} value={bgColor} onChange={(e) => update("bgColor", e.target.value)} />
            </FormControl>
          </div>
        </div>

        {/* Logo */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Logo</p>
          <div className={styles.logoRow}>
            <div className={styles.fileField}>
              <span className={styles.fileLabel}>Insira seu logo</span>
              <label className={styles.fileBtn}>
                <UploadIcon size={14} />
                Escolher arquivo
                <input type="file" accept="image/*" className={styles.fileInput} onChange={handleLogoChange} />
              </label>
            </div>
            <FormControl>
              <FormControl.Label>Tamanho da logo</FormControl.Label>
              <Select value={String(logoSize)} onChange={(e) => update("logoSize", Number.parseInt(e.target.value))}>
                <Select.Option value="24">24px × 24px</Select.Option>
                <Select.Option value="38">38px × 38px</Select.Option>
                <Select.Option value="50">50px × 50px</Select.Option>
              </Select>
            </FormControl>
          </div>
        </div>

        {showDownload && (
          <button className={styles.downloadBtn} onClick={handleDownload}>
            Baixar QR Code
          </button>
        )}
      </div>
    </div>
  );
}

QrCodeCustomizer.propTypes = {
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  settings: PropTypes.shape({
    fgColor: PropTypes.string,
    bgColor: PropTypes.string,
    logoURL: PropTypes.string,
    logoSize: PropTypes.number,
  }),
  onChange: PropTypes.func,
  showUrlInput: PropTypes.bool,
  showDownload: PropTypes.bool,
  size: PropTypes.number,
};
