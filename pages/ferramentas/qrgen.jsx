import { QRCodeCanvas } from "qrcode.react";
import { UploadIcon } from "@primer/octicons-react";
import styles from "./qrgen.module.css";
import { Select } from "@primer/react";
import { useRef, useState } from "react";

export default function QrGen() {
  const [linkValue, setLinkValue] = useState("");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [logoURL, setLogoURL] = useState("/images/logo.png");
  const [logoSize, setLogoSize] = useState(24);
  const qrCodeRef = useRef(null);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setLogoURL(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    if (!qrCodeRef.current) return;
    const canvas = qrCodeRef.current.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "qr-code.png";
    link.click();
  };
  return (
    <main className={styles.container}>
      <section className={styles.titleContainer}>
        <h1 className={styles.pageTitle}>
          Gere e customize QR Codes <span>dinâmicos</span>
        </h1>
        <img src="/arrow.svg" alt="detail" className={styles.arrowDetail} />
      </section>
      <section className={styles.qrCodeContainer}>
        <div className={styles.qrCode}>
          <div className={styles.linkInput}>
            <label htmlFor="link">Digite seu link:</label>
            <input type="text" id="link" name="link" placeholder="Seu link aqui" value={linkValue} onChange={(e) => setLinkValue(e.target.value)} />
          </div>
          <div className={styles.qrCodePreview}>
            <p>QR Code Preview</p>
            <div ref={qrCodeRef}>
              <QRCodeCanvas
                value={linkValue}
                title={linkValue}
                size={200}
                fgColor={fgColor}
                bgColor={bgColor}
                level={"L"}
                imageSettings={{
                  src: logoURL,
                  x: undefined,
                  y: undefined,
                  height: logoSize,
                  width: logoSize,
                  opacity: 1,
                  excavate: true,
                  crossOrigin: "anonymous",
                }}
              />
            </div>
          </div>
        </div>
        <div className={styles.qrCodeCustomization}>
          <div className={styles.customizationContainer}>
            <h3>Cores</h3>
            <div className={`${styles.inputContainer} ${styles.colors}`}>
              <div className={styles.inputBox}>
                <label htmlFor="fgColor">Cor Principal</label>
                <input type="color" id="fgColor" className={styles.inputColor} value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
              </div>
              <div className={styles.inputBox}>
                <label htmlFor="bgColor">Cor de Fundo</label>
                <input type="color" id="bgColor" className={styles.inputColor} value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div className={styles.customizationContainer}>
            <h3>Logo</h3>
            <div className={styles.inputContainer}>
              <div className={styles.inputBox}>
                <label htmlFor="logo">Insira seu logo</label>
                <input type="file" id="logo" className={styles.inputFile} accept="image/*" onChange={handleLogoChange} />
                <button className={styles.inputFileButton}>
                  <UploadIcon />
                  Escolher arquivo
                </button>
              </div>
              <div className={styles.inputBox}>
                <label htmlFor="logoSize">Tamanho da logo</label>
                <Select name="logoSize" id={styles.logoSize} value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value))}>
                  <Select.Option value="24">24px x 24px</Select.Option>
                  <Select.Option value="38">38px x 38px</Select.Option>
                  <Select.Option value="50">50px x 50px</Select.Option>
                </Select>
              </div>
            </div>
          </div>
          <button className={styles.downloadButton} onClick={handleDownload}>
            Baixar QR Code
          </button>
        </div>
      </section>
    </main>
  );
}
