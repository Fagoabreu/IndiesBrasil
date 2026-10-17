import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import user from "@/models/user";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/** Ações aceitas para o estúdio de uma conta que vai ser excluída. */
const STUDIO_ACTIONS = ["delete", "transfer"];

/**
 * POST /api/v1/admin/users/purge
 *
 * Exclui uma conta **definitivamente**, pelo email. Body (JSON):
 * `{ email, confirm_email, studio_action?, confirm_studio_slug?, transfer_to_user_id? }`.
 *
 * O `confirm_email` não é decoração: a exclusão apaga posts, comentários,
 * curtidas, conversas e sessões, e não existe desfazer. Exigir que o operador
 * repita o endereço impede que um clique errado (ou um email alterado pela
 * última edição do campo) remova outra conta — o servidor recusa quando os dois
 * valores não são exatamente o mesmo endereço.
 *
 * Quando a conta é **titular de um estúdio**, a exclusão exige uma decisão sobre
 * ele (`studio_action`), com a própria confirmação:
 * - `"delete"` + `confirm_studio_slug`: apaga o estúdio, as obras e os posts
 *   publicados em nome dele;
 * - `"transfer"` + `transfer_to_user_id`: passa a titularidade a um membro
 *   ativo, e só então exclui a conta.
 *
 * A rota valida a forma dos campos (enum, presença); as regras de negócio
 * (membro ativo, slug do estúdio, não excluir a si mesmo, conta admin, histórico
 * de moderação) ficam no model, junto da transação que apaga tudo ou nada.
 */
export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const admin = request.context.user;

    if (!authorization.can(admin, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para excluir contas.",
      });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError({
        message: "Corpo da requisição inválido.",
        action: "Envie `email` e `confirm_email` em JSON.",
      });
    }

    const email = String(body.email ?? "").trim();
    const confirmEmail = String(body.confirm_email ?? "").trim();

    if (!email) {
      throw new ValidationError({
        message: "Informe o email da conta a ser excluída.",
        action: "Preencha o campo `email`.",
      });
    }

    // Comparação sem diferenciar caixa (o email é único assim no banco), mas
    // exigindo igualdade do endereço inteiro — nada de prefixo nem de confirmação
    // por id, que não prova que o operador leu de quem se trata.
    if (confirmEmail.toLowerCase() !== email.toLowerCase()) {
      throw new ValidationError({
        message: "A confirmação não corresponde ao email informado.",
        action: "Digite novamente o email exato da conta para confirmar a exclusão.",
      });
    }

    // `undefined` = conta que não é titular de estúdio (o model decide se é
    // exigido). Qualquer valor fora do enum é erro de quem chamou, não um
    // caminho alternativo.
    const rawStudioAction = body.studio_action;
    const studioAction = rawStudioAction === undefined ? undefined : String(rawStudioAction);

    if (studioAction !== undefined && !STUDIO_ACTIONS.includes(studioAction)) {
      throw new ValidationError({
        message: `Ação de estúdio inválida: ${JSON.stringify(rawStudioAction)}.`,
        action: `Use ${STUDIO_ACTIONS.map((action) => `\`${action}\``).join(" ou ")}.`,
      });
    }

    const summary = await user.purgeByEmail(email, {
      performedByUserId: admin.id,
      studioAction,
      confirmStudioSlug: body.confirm_studio_slug,
      transferToUserId: body.transfer_to_user_id,
    });

    return Response.json(summary, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
