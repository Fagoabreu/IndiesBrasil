import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import profile from "@/models/profile";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("update:user"), postHandler);
router.get(controller.canRequest("read:user"), getHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const username = request.query.username;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsernameSecured(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  userInputValues.user_id = targetUser.id;
  const postedContact = await profile.saveContato(userInputValues);
  return response.status(200).json(postedContact);
}

async function getHandler(request, response) {
  const username = request.query.username;
  const targetUser = await user.findOneByUsernameSecured(username);
  const newFound = await profile.findContactsByUserId(targetUser.id);
  return response.status(200).json(newFound);
}
