import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import user from "models/user";
import { ForbiddenError } from "infra/errors";
import { requireMemberManager } from "lib/studioAccess";
import { canGrantRole, canRemoveMember, canRevokeRole, parseMemberRole } from "lib/studioPermissions";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("create:studio:member"), patchHandler)
  .delete(controller.canRequest("delete:studio:member"), deleteHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const { slug, username: targetUsername } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  const actorRole = await requireMemberManager(requestUser, studio);

  const targetUser = await user.findOneByUsername(targetUsername);
  const { addRole, removeRole } = request.body;

  if (addRole) {
    const role = parseMemberRole(addRole);

    if (!canGrantRole(actorRole, role)) {
      throw new ForbiddenError({
        message: "Apenas o responsável pelo estúdio pode conceder acesso de administrador.",
      });
    }

    await organization.setMemberRole(studio.id, targetUser.id, role, requestUser.id);
  }

  if (removeRole) {
    const role = parseMemberRole(removeRole);

    if (!canRevokeRole(actorRole, role)) {
      throw new ForbiddenError({
        message: "Apenas o responsável pelo estúdio pode revogar o acesso de administrador.",
      });
    }

    // Não permite remover a role de admin do dono
    if (role === "admin" && studio.owner_id === targetUser.id) {
      throw new ForbiddenError({
        message: "Não é possível remover a role de admin do responsável pelo estúdio.",
      });
    }

    await organization.revokeMemberRole(studio.id, targetUser.id, role, requestUser.id);
  }

  const members = await organization.findMembers(studio.id);
  return response.status(200).json(members);
}

async function deleteHandler(request, response) {
  const { slug, username: targetUsername } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  const targetUser = await user.findOneByUsername(targetUsername);

  // O responsável não sai do estúdio (nem por mão própria): a titularidade só
  // muda por transferência, que ainda não tem rota.
  if (studio.owner_id === targetUser.id) {
    throw new ForbiddenError({
      message: "O responsável pelo estúdio não pode ser removido. Transfira a responsabilidade primeiro.",
    });
  }

  // Remover um admin revoga o papel dele, então a checagem precisa do papel de
  // quem remove **e** do alvo — é o que impede um admin de derrubar o outro.
  const [actorRole, targetRole] = await Promise.all([
    organization.resolveMemberRole(studio.id, requestUser.id),
    organization.resolveMemberRole(studio.id, targetUser.id),
  ]);

  if (!canRemoveMember(actorRole, targetRole, requestUser.id === targetUser.id)) {
    throw new ForbiddenError({
      message: "Sem permissão para remover este membro.",
    });
  }

  await organization.removeMember(studio.id, targetUser.id, requestUser.id);
  return response.status(204).end();
}
