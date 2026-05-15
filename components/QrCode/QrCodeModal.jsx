import { useState } from "react";
import PropTypes from "prop-types";
import { Button, Dialog } from "@primer/react";
import QrCodeCustomizer, { DEFAULT_QR_SETTINGS } from "./QrCodeCustomizer";
import styles from "./QrCodeModal.module.css";

/**
 * Modal para edição das propriedades visuais do QR Code.
 * O link não pode ser editado — é definido externamente (ex.: URL do perfil).
 *
 * @param {string}   value           - URL fixa codificada no QR (somente leitura)
 * @param {object}   initialSettings - Estado inicial { fgColor, bgColor, logoURL, logoSize }
 * @param {function} onSave          - Chamado com o novo objeto settings ao salvar
 * @param {function} onClose         - Chamado ao fechar/cancelar
 */
export default function QrCodeModal({ value, initialSettings, onSave, onClose }) {
  const [settings, setSettings] = useState(initialSettings ?? DEFAULT_QR_SETTINGS);

  return (
    <Dialog onDismiss={onClose} onClose={onClose} aria-labelledby="qr-modal-title" wide>
      <Dialog.Header id="qr-modal-title">Personalizar QR Code</Dialog.Header>

      <div className={styles.body}>
        <QrCodeCustomizer value={value} settings={settings} onChange={setSettings} showUrlInput={false} showDownload={false} size={170} />
      </div>

      <Dialog.Footer>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={() => onSave(settings)}>
          Salvar
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}

QrCodeModal.propTypes = {
  value: PropTypes.string.isRequired,
  initialSettings: PropTypes.shape({
    fgColor: PropTypes.string,
    bgColor: PropTypes.string,
    logoURL: PropTypes.string,
    logoSize: PropTypes.number,
  }),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
