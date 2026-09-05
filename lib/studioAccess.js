import organization from "@/models/organization";
import { ForbiddenError } from "@/infra/errors";

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
