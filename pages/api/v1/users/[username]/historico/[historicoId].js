import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import profile from "@/models/profile";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.patch(controller.canRequest("update:user"), patchHandler);
router.delete(controller.canRequest("update:user"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const username = request.query.username;
  const historicoId = request.query.historicoId;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  userInputValues.id = historicoId;
  const postedHistory = await profile.patchHistorico(userInputValues);
  return response.status(200).json(postedHistory);
}

async function deleteHandler(request, response) {
  const username = request.query.username;
  const historicoId = request.query.historicoId;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const postedHistory = await profile.deleteHistoricoById(historicoId);
  return response.status(200).json(postedHistory);
}
