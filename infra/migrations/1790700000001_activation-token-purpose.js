/**
 * Separa o token de ativação do token de redefinição de senha.
 *
 * ## O problema
 *
 * `user_activation_tokens` guarda os dois com o **mesmo formato e nenhuma
 * coluna que os distinga**. A coluna existia só como "tokens de vida curta do
 * usuário", e `activation.create(userId)` era usado tanto ao cadastrar quanto ao
 * pedir nova senha — o mesmo `id` servia para as duas coisas.
 *
 * O efeito prático: um e-mail de **ativação** guardado na caixa de entrada (ou
 * encaminhado para o suporte) virava credencial de **troca de senha** dentro da
 * validade de 1 hora, porque `changePasswordByToken` só exigia "token válido
 * deste usuário". Ele não pedia que o token tivesse sido emitido para redefinir
 * senha — quem tivesse acesso ao e-mail antigo trocava a senha sem passar pelo
 * fluxo de reset, que exige e-mail **e** CPF.
 *
 * ## O que muda
 *
 * Uma coluna `purpose` com dois valores possíveis:
 *
 *  - `activation` — confirma o cadastro (`/cadastro/ativar/<token>`);
 *  - `reset`      — redefine a senha (`/cadastro/reset-password/<token>`).
 *
 * O `DEFAULT 'activation'` é o que dá compatibilidade com as linhas que já
 * existem: token de ativação em aberto continua valendo para o que foi emitido.
 * Um token de reset pendente no momento da migration também vira `activation` —
 * e esse é o lado seguro de errar: ele deixa de servir para trocar senha (o que
 * era a vulnerabilidade) e o usuário pede o link de novo, sem nada quebrado
 * permanentemente.
 *
 * O `CHECK` existe para o valor não virar texto livre: a checagem no código é uma
 * comparação, e um typo (`"reset_password"`) negaria acesso a um token legítimo
 * de forma silenciosa.
 */
exports.up = (pgm) => {
  pgm.addColumn("user_activation_tokens", {
    purpose: {
      type: "varchar(20)",
      notNull: true,
      default: "activation",
    },
  });

  pgm.addConstraint("user_activation_tokens", "user_activation_tokens_purpose_check", {
    check: "purpose IN ('activation', 'reset')",
  });

  // Busca por finalidade: as consultas filtram `purpose` junto de `id`/`user_id`
  // (sempre por token específico), então o índice não precisa ser grande — mas
  // sem ele a varredura por usuário em `findOneValidById` ficaria seqüencial.
  pgm.createIndex("user_activation_tokens", ["user_id", "purpose"], {
    name: "user_activation_tokens_user_purpose_idx",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("user_activation_tokens", ["user_id", "purpose"], {
    name: "user_activation_tokens_user_purpose_idx",
  });
  pgm.dropConstraint("user_activation_tokens", "user_activation_tokens_purpose_check");
  pgm.dropColumn("user_activation_tokens", "purpose");
};
