import { Dialog } from "@primer/react";
import PropTypes from "prop-types";
import styles from "./ConfirmDialog.module.css";

/**
 * Confirmação para ação destrutiva.
 *
 * Existe porque o botão de excluir agia na primeira batida: um clique errado no
 * feed apagava o post e os comentários dele, sem desfazer. `role="alertdialog"`
 * porque a consequência é irreversível — o leitor de tela anuncia a pergunta
 * antes de entregar o foco ao botão.
 *
 * Genérico de propósito: exclusão de comentário, de notícia e de qualquer outro
 * recurso destrutivo deve usar este componente — não `window.confirm` (que
 * ignora o tema por cookie e não usa o Primer) nem um modal próprio por tela.
 */
export default function ConfirmDialog({
  title,
  description,
  details,
  error,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  // Durante a operação o diálogo não fecha: fechar no meio daria a impressão de
  // cancelamento quando o pedido já foi enviado.
  function handleClose() {
    if (loading) return;
    onClose();
  }

  return (
    <Dialog
      title={title}
      role="alertdialog"
      onClose={handleClose}
      footerButtons={[
        {
          buttonType: "default",
          content: cancelLabel,
          onClick: handleClose,
          disabled: loading,
        },
        {
          buttonType: danger ? "danger" : "primary",
          content: confirmLabel,
          onClick: onConfirm,
          loading,
          disabled: loading,
        },
      ]}
    >
      <div className={styles.body}>
        {/* Falha da própria ação fica no diálogo: fechá-lo com erro escondido
            faria a exclusão malsucedida parecer concluída. */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {children ?? (
          <>
            {description && <p className={styles.description}>{description}</p>}
            {details && <p className={styles.details}>{details}</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}

ConfirmDialog.propTypes = {
  title: PropTypes.string.isRequired,
  /** Pergunta principal. */
  description: PropTypes.string,
  /** O que se perde e se dá para desfazer. */
  details: PropTypes.string,
  /** Mensagem de falha da ação; mantém o diálogo aberto. */
  error: PropTypes.string,
  /** Conteúdo próprio; tem precedência sobre `description`/`details`. */
  children: PropTypes.node,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  /** Pinta o botão de confirmar em vermelho (`danger`). */
  danger: PropTypes.bool,
  loading: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
