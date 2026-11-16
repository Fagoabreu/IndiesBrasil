import { ORDER_STATUS_LABELS } from "lib/store-constants";
import { SITE_NAME } from "@/lib/seo";

function storeOrderUpdatedEmailTemplate({ recipientUsername, productName, status, note }) {
  const statusLabel = ORDER_STATUS_LABELS[status] || status;

  const text = `
Olá, ${recipientUsername}!

O status do seu pedido foi atualizado.

Produto: ${productName}
Novo status: ${statusLabel}
${note ? `\nObservação:\n${note}\n` : ""}
Atenciosamente,
Equipe ${SITE_NAME}
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #24292f; line-height: 1.5;">
      <h2>Olá, ${recipientUsername}!</h2>

      <p>O status do seu pedido foi <strong>atualizado</strong>.</p>

      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">Produto</td>
          <td style="padding: 6px 12px;">${productName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">Novo status</td>
          <td style="padding: 6px 12px;">${statusLabel}</td>
        </tr>
      </table>

      ${note ? `<p><strong>Observação:</strong><br/>${note}</p>` : ""}

      <p>Atenciosamente,<br/>Equipe ${SITE_NAME}</p>
    </div>
  `.trim();

  return { text, html };
}

export default storeOrderUpdatedEmailTemplate;
