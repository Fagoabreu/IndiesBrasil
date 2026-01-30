import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);
router.patch(controller.canRequest("update:user"), patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const username = request.query.username;
  const newFound = await user.findOneByUsernameSecured(username);
  return response.status(200).json(newFound);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsernameSecured(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const updatedUser = await user.update(username, userInputValues);
  return response.status(200).json(updatedUser);
}
