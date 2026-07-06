import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import user from "models/user";
import { ForbiddenError, ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("create:studio:member"), patchHandler)
  .delete(controller.canRequest("delete:studio:member"), deleteHandler)
  .handler(controller.errorHandlers);

async function requireAdmin(requestUser, studio) {
  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  const isOwner = studio.owner_id === requestUser.id;
  if (!isAdmin && !isOwner) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem gerenciar membros.",
    });
  }
}

async function patchHandler(request, response) {
  const { slug, username: targetUsername } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  await requireAdmin(requestUser, studio);

  const targetUser = await user.findOneByUsername(targetUsername);
  const { addRole, removeRole } = request.body;

  if (addRole) {
    if (!["admin", "member"].includes(addRole)) {
      throw new ValidationError({
        message: `Role inválida: ${addRole}. Use 'admin' ou 'member'.`,
      });
    }
    await organization.setMemberRole(
      studio.id,
      targetUser.id,
      addRole,
      requestUser.id,
    );
  }

  if (removeRole) {
    // Não permite remover a role de admin do dono
    if (removeRole === "admin" && studio.owner_id === targetUser.id) {
      throw new ForbiddenError({
        message:
          "Não é possível remover a role de admin do responsável pelo estúdio.",
      });
    }
    await organization.revokeMemberRole(studio.id, targetUser.id, removeRole);
  }

  const members = await organization.findMembers(studio.id);
  return response.status(200).json(members);
}

async function deleteHandler(request, response) {
  const { slug, username: targetUsername } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  const targetUser = await user.findOneByUsername(targetUsername);

  // Membro pode se remover; admins/dono podem remover qualquer um (exceto o dono)
  const isSelf = requestUser.id === targetUser.id;
  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  const isOwner = studio.owner_id === requestUser.id;

  if (!isSelf && !isAdmin && !isOwner) {
    throw new ForbiddenError({
      message: "Sem permissão para remover este membro.",
    });
  }

  if (studio.owner_id === targetUser.id) {
    throw new ForbiddenError({
      message:
        "O responsável pelo estúdio não pode ser removido. Transfira a responsabilidade primeiro.",
    });
  }

  await organization.removeMember(studio.id, targetUser.id);
  return response.status(204).end();
}
