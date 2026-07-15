import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import profile from "@/models/profile";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:user"), patchHandler)
  .delete(controller.canRequest("update:user"), deleteHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const username = request.query.username;
  const roleName = request.query.name;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const postedRole = await profile.patchRoles(targetUser.id, roleName, userInputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToPatch, "read:profile_role", postedRole);
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const username = request.query.username;
  const roleName = request.query.name;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const deletedRole = await profile.deleteRoleByUserAndRole(targetUser.id, roleName);
  const secureOutputValues = authorization.filterOutput(userTryingToPatch, "read:profile_role", deletedRole);

  return response.status(200).json(secureOutputValues);
}
