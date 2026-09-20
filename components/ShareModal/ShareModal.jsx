import { useState } from "react";
import { Dialog } from "@primer/react";
import { CopyIcon, CheckIcon, LinkIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";
import { SITE_URL } from "@/lib/seo";
import styles from "./ShareModal.module.css";

/**
 * Modal de compartilhamento de link (post, perfil, etc.).
 *
 * Recebe `path` — o caminho relativo — em vez da URL absoluta: assim o domínio
 * fica resolvido num só lugar (`SITE_URL`), sem cada chamador montar a URL
 * completa por conta própria.
 *
 * O texto sugerido (`text`) também vem do chamador, porque o que faz sentido
 * compartilhar muda conforme o conteúdo ("confira este post" x "veja o perfil").
 */
export default function ShareModal({ path, text, title = "Compartilhar", hint, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${SITE_URL}${path}`;
  const shareText = text || "Confira no Indies Brasil!";
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent([shareText, shareUrl].join("\n\n"))}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: browser não suporta clipboard API
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footerButtons={[]}
      renderBody={() => (
        <div className={styles.body}>
          <p className={styles.hint}>{hint || "Copie o link e cole no WhatsApp, Discord ou Instagram. A miniatura será exibida automaticamente."}</p>

          {/* Link copiável */}
          <div className={styles.inputRow}>
            <input type="text" readOnly value={shareUrl} className={styles.input} onClick={(e) => e.target.select()} />
            <button type="button" className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`} onClick={handleCopy}>
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          {/* WhatsApp */}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.whatsappBtn}>
            <LinkIcon size={14} />
            Compartilhar no WhatsApp
          </a>
        </div>
      )}
    />
  );
}

ShareModal.propTypes = {
  /** Caminho relativo, ex.: "/perfil/nomedousuario". */
  path: PropTypes.string.isRequired,
  /** Texto sugerido que acompanha o link. */
  text: PropTypes.string,
  title: PropTypes.string,
  hint: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
