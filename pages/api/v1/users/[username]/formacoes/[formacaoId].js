import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";
import profile from "@/models/profile.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:user"), patchHandler)
  .delete(controller.canRequest("update:user"), deleteHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const username = request.query.username;
  const formacaoId = request.query.formacaoId;
  const userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const patchedFormacao = await profile.patchFormacoes(targetUser.id, formacaoId, userInputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToPatch, "read:profile_formacoes", patchedFormacao);
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const username = request.query.username;
  const formacaoId = request.query.formacaoId;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const deletedFormacao = await profile.deleteFormacaoByUserAndId(targetUser.id, formacaoId);
  const secureOutputValues = authorization.filterOutput(userTryingToPatch, "read:profile_formacoes", deletedFormacao);

  return response.status(200).json(secureOutputValues);
}
