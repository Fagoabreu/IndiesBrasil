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
  const toolId = request.query.toolId;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }
  const postedProfileTool = await profile.patchTools(targetUser.id, toolId, userInputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToPatch, "read:profile_tool", postedProfileTool);
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const username = request.query.username;
  const toolId = request.query.toolId;

  const userTryingToDelete = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToDelete, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }
  const postedContact = await profile.deleteToolByUserAndTool(targetUser.id, toolId);
  const secureOutputValues = authorization.filterOutput(userTryingToDelete, "read:profile_contact", postedContact);

  return response.status(200).json(secureOutputValues);
}
