import { formatBRL } from "lib/currency";

function storeOrderReceivedEmailTemplate({ studioName, buyerUsername, productName, quantity, total, note }) {
  const totalFormatted = formatBRL(total);

  const text = `
Olá, ${studioName}!

Você recebeu um novo pedido na sua loja do Indies Brasil.

Produto: ${productName}
Quantidade: ${quantity}
Valor total: ${totalFormatted}
${note ? `\nMensagem do comprador:\n${note}\n` : ""}
Comprador: @${buyerUsername}

Acesse o painel da sua loja para enviar o orçamento de frete e prazo de entrega.

Atenciosamente,
Equipe Indies Brasil
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #24292f; line-height: 1.5;">
      <h2>Olá, ${studioName}!</h2>

      <p>Você recebeu um <strong>novo pedido</strong> na sua loja do Indies Brasil.</p>

      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">Produto</td>
          <td style="padding: 6px 12px;">${productName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">Quantidade</td>
          <td style="padding: 6px 12px;">${quantity}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">Valor total</td>
          <td style="padding: 6px 12px;">${totalFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">Comprador</td>
          <td style="padding: 6px 12px;">@${buyerUsername}</td>
        </tr>
      </table>

      ${note ? `<p><strong>Mensagem do comprador:</strong><br/>${note}</p>` : ""}

      <p>Acesse o painel da sua loja para enviar o orçamento de frete e o prazo de entrega.</p>

      <p>Atenciosamente,<br/>Equipe Indies Brasil</p>
    </div>
  `.trim();

  return { text, html };
}

export default storeOrderReceivedEmailTemplate;
