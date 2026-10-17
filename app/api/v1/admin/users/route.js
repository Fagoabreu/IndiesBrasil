import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import user from "@/models/user";
import organization from "@/models/organization";
import { ForbiddenError, ValidationError } from "@/infra/errors";

/**
 * GET /api/v1/admin/users?email=
 *
 * Busca **uma** conta pelo email, para o administrador confirmar de quem se
 * trata antes de excluí-la. É o passo de leitura da tela `/admin/users`: a
 * exclusão é irreversível, e o operador precisa ver username, data de cadastro
 * e se a conta já foi ativada antes de digitar a confirmação.
 *
 * Exige `read:admin`, como todas as rotas de moderação do projeto.
 *
 * Quando a conta é **titular de um estúdio**, a resposta traz o estúdio e os
 * membros ativos com seus papéis: é o que permite ao administrador escolher
 * entre excluir o estúdio e as obras ou transferir a responsabilidade — e, no
 * caso da transferência, escolher para quem. Sem os membros aqui, a tela teria
 * de pedir um id de usuário que ninguém sabe de cabeça.
 *
 * A resposta é montada campo a campo de propósito: `findOneByEmail` seleciona
 * `*`, que inclui `password` (hash) e `cpf` — um spread publicaria os dois para
 * o navegador.
 */
export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const admin = request.context.user;

    if (!authorization.can(admin, "read:admin")) {
      throw new ForbiddenError({
        message: "Acesso restrito a administradores.",
        action: "Você não possui permissão para consultar contas por email.",
      });
    }

    const email = (request.nextUrl.searchParams.get("email") || "").trim();

    if (!email) {
      throw new ValidationError({
        message: "Informe o email da conta.",
        action: "Use `?email=` com o endereço completo.",
      });
    }

    // `findOneByEmail` lança NotFoundError, que o handler converte em 404.
    const found = await user.findOneByEmail(email);
    const studio = await organization.findOwnedWithMembers(found.id);

    return Response.json({
      id: found.id,
      username: found.username,
      email: found.email,
      created_at: found.created_at,
      activated: Array.isArray(found.features) && found.features.includes("create:session"),
      is_admin: Array.isArray(found.features) && found.features.includes("read:admin"),
      // `roles` já vem de `findMembers`; `is_owner` é derivado de `owner_id`, e
      // não de `org_roles` — o dono recebe a role `admin` na criação, mas quem
      // manda na titularidade é a coluna.
      studio: studio
        ? {
            id: studio.id,
            slug: studio.slug,
            name: studio.name,
            members: studio.members.map((member) => ({
              id: member.id,
              username: member.username,
              roles: member.roles ?? [],
              is_owner: member.id === found.id,
            })),
          }
        : null,
    });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
