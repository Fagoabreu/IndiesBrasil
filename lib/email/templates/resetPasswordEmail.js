function resetPasswordEmailTemplate({ username, resetLink }) {
  const text = `
Olá, ${username}!

Recebemos uma solicitação para redefinir a senha da sua conta no Indies Brasil.

Para criar uma nova senha, acesse o link abaixo:

${resetLink}

Se você não solicitou essa redefinição, ignore este e-mail com segurança.

Atenciosamente,
Equipe Indies Brasil
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #24292f; line-height: 1.5;">
      <h2>Olá, ${username}!</h2>

      <p>
        Recebemos uma solicitação para redefinir a senha da sua conta no
        <strong>Indies Brasil</strong>.
      </p>

      <p>
        Para criar uma nova senha, clique no botão abaixo:
      </p>

      <p style="margin: 24px 0;">
        <a
          href="${resetLink}"
          style="
            background-color: #d29922;
            color: #ffffff;
            padding: 12px 20px;
            text-decoration: none;
            border-radius: 6px;
            display: inline-block;
            font-weight: bold;
          "
        >
          Redefinir senha
        </a>
      </p>

      <p>
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:
      </p>

      <p>
        <a href="${resetLink}">${resetLink}</a>
      </p>

      <hr style="margin: 32px 0;" />

      <p style="font-size: 14px; color: #57606a;">
        Se você não solicitou essa redefinição, nenhuma ação é necessária.
      </p>

      <p style="font-size: 14px; color: #57606a;">
        Atenciosamente,<br />
        Equipe Indies Brasil
      </p>
    </div>
  `;

  return { html, text };
}

export default resetPasswordEmailTemplate;
