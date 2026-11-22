import { Flash } from "@primer/react";
import PropTypes from "prop-types";

/**
 * Mensagem de status de uma tela.
 *
 * ## Duas APIs convivem de propósito
 *
 * A forma original recebia `errorMsg` (objeto `{ message, action }`) e
 * `successMsg` (texto) — é o que login, cadastro, perfil e status usam.
 *
 * As telas de estúdio, assets e cursos guardam o estado como `{ type, text }` e
 * passavam `type` + `message`. O componente ignorava essas props e renderizava
 * `<div></div>`: **13 chamadas** silenciosas — o 400/403 de salvar serviços, de
 * editar asset ou de publicar aula simplesmente não aparecia, e a ação parecia
 * não ter acontecido. Aceitar as duas formas (em vez de migrar 13 telas) mantém
 * o contrato antigo e conserta todas de uma vez.
 *
 * `type` aceita `error`/`danger` (o carregamento do editor de serviços usa
 * `danger`), `success` e `warning`.
 */
export default function StatusMessageComponent({ type, message, errorMsg, successMsg }) {
  if (errorMsg) {
    return (
      <div>
        <Flash variant="danger">
          <strong>{errorMsg.message}</strong>
          {errorMsg.action && <div style={{ marginTop: 4 }}>{errorMsg.action}</div>}
        </Flash>
      </div>
    );
  }

  const text = message ?? successMsg;
  if (!text) return null;

  const variant = type === "success" ? "success" : type === "warning" ? "warning" : "danger";

  return (
    <div>
      <Flash variant={variant} style={{ whiteSpace: "pre-line" }}>
        {text}
      </Flash>
    </div>
  );
}

StatusMessageComponent.propTypes = {
  /** API nova: `{ type, text }` das telas de estúdio/assets/cursos. */
  type: PropTypes.oneOf(["error", "danger", "success", "warning"]),
  message: PropTypes.string,
  /** API original: erro com ação sugerida. */
  errorMsg: PropTypes.shape({
    message: PropTypes.string.isRequired,
    action: PropTypes.string,
  }),
  successMsg: PropTypes.string,
};
