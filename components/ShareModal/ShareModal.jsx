import { useState } from "react";
import { Dialog } from "@primer/react";
import { CopyIcon, CheckIcon, LinkIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";
import { SITE_URL } from "@/lib/seo";
import styles from "./ShareModal.module.css";

ShareModal.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  postContent: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

export default function ShareModal({ postId, postContent, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${SITE_URL}/posts/${postId}`;
  const shareText = postContent?.slice(0, 200) || "Confira este post no Indies Brasil!";
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`;

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
      title="Compartilhar post"
      onClose={onClose}
      footerButtons={[]}
      renderBody={() => (
        <div className={styles.body}>
          <p className={styles.hint}>Copie o link e cole no WhatsApp, Discord ou Instagram. A miniatura do post será exibida automaticamente.</p>

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
