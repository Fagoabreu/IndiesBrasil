function activationEmailTemplate({ username, activationLink }) {
  const text = `
Olá, ${username}!

Para finalizar seu cadastro no Indies Brasil, acesse o link abaixo:

${activationLink}

Se você não solicitou este cadastro, apenas ignore este e-mail.

Atenciosamente,
Equipe Indies Brasil
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #24292f; line-height: 1.5;">
      <h2>Olá, ${username}!</h2>

      <p>
        Seja bem-vindo ao <strong>Indies Brasil</strong>!
        Para finalizar seu cadastro, clique no botão abaixo:
      </p>

      <p style="margin: 24px 0;">
        <a
          href="${activationLink}"
          style="
            background-color: #2da44e;
            color: #ffffff;
            padding: 12px 20px;
            text-decoration: none;
            border-radius: 6px;
            display: inline-block;
            font-weight: bold;
          "
        >
          Ativar meu cadastro
        </a>
      </p>

      <p>
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:
      </p>

      <p>
        <a href="${activationLink}">${activationLink}</a>
      </p>

      <hr style="margin: 32px 0;" />

      <p style="font-size: 14px; color: #57606a;">
        Se você não solicitou este cadastro, pode ignorar este e-mail com segurança.
      </p>

      <p style="font-size: 14px; color: #57606a;">
        Atenciosamente,<br />
        Equipe Indies Brasil
      </p>
    </div>
  `;

  return { html, text };
}

export default activationEmailTemplate;
