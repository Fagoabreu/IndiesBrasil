import organization from "@/models/organization";
import { ForbiddenError } from "@/infra/errors";
import { roleCan } from "@/lib/studioPermissions";

/**
 * Garante que o usuário é dono, admin ou membro ativo do estúdio.
 * Lança ForbiddenError caso contrário. Usado pelas rotas de recursos
 * internos do estúdio (ex.: reuniões/webconferência).
 * @param {{ id: string }} requestUser usuário autenticado (request.context.user)
 * @param {{ id: string, owner_id: string }} studio organização resolvida por slug
 */
export async function ensureStudioMemberOrOwner(requestUser, studio) {
  if (studio.owner_id === requestUser.id) return;

  const isMember = await organization.isMember(studio.id, requestUser.id);
  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);

  if (!isMember && !isAdmin) {
    throw new ForbiddenError({
      message: "Apenas membros do estúdio podem acessar este recurso.",
    });
  }
}

/**
 * Garante que o usuário pode **gerenciar membros** do estúdio e devolve o papel
 * efetivo dele.
 *
 * Devolve o papel (em vez de apenas validar) porque as checagens seguintes —
 * conceder, revogar ou remover um administrador — têm regra própria e mais
 * restrita, e resolvê-lo aqui evita uma segunda consulta.
 *
 * Esta função **não é a garantia**: quem grava é `models/organization.js`, que
 * reaplica a invariante. Aqui a função existe para recusar cedo e traduzir a
 * recusa em 403 antes de tocar no banco.
 */
export async function requireMemberManager(requestUser, studio) {
  const role = await organization.resolveMemberRole(studio.id, requestUser.id);

  if (!roleCan(role, "manageMembers")) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem gerenciar membros.",
    });
  }

  return role;
}
