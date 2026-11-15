/**
 * Remetente dos e-mails transacionais — uma fonte só.
 *
 * O nome de exibição e o endereço estavam duplicados em `models/activation.js`
 * (dois `from:` literais) e em `models/store.js` (`EMAIL_FROM`). Duas cópias
 * divergem em silêncio, e a divergência só aparece na caixa de entrada de quem
 * recebe: na migração de marca, o risco concreto era o e-mail de ativação
 * continuar assinado com o nome antigo enquanto o de pedido já saía com o novo.
 *
 * ## Por que o endereço é separado do nome
 *
 * A caixa postal **não** acompanha a marca automaticamente. Trocar
 * `contato@indies.com.br` sem criar a caixa nova e configurar SPF/DKIM não
 * "atualiza" nada: derruba a entrega do e-mail de ativação (o cadastro fica
 * travado, porque ninguém recebe o token) e do reset de senha. Por isso o
 * endereço é uma variável própria, com o valor atual como padrão — mudar é uma
 * linha no ambiente, reversível sem deploy de código.
 */

import { SITE_NAME } from "@/lib/seo";

/**
 * Caixa postal remetente.
 *
 * Padrão: `contato@indies.com.br`, o endereço que já tem histórico de entrega.
 * Quando `contato@jogos.social.br` existir e estiver autenticado (SPF, DKIM e
 * DMARC), basta definir `EMAIL_FROM_ADDRESS` no ambiente.
 */
export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "contato@indies.com.br";

/** Valor para o campo `from` do nodemailer: `Nome <endereco>`. */
export const EMAIL_FROM = `${SITE_NAME} <${EMAIL_FROM_ADDRESS}>`;

const sender = {
  EMAIL_FROM,
  EMAIL_FROM_ADDRESS,
};

export default sender;
