import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import profile from "@/models/profile";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("update:user"), postHandler)
  .get(controller.canRequest("read:user"), getHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const username = request.query.username;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsernameSecured(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action:
        "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  userInputValues.user_id = targetUser.id;
  const postedContact = await profile.saveContato(userInputValues);
  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:profile_contact",
    postedContact,
  );
  return response.status(200).json(secureOutputValues);
}

async function getHandler(request, response) {
  const userTryingToGet = request.context.use;
  const username = request.query.username;
  const targetUser = await user.findOneByUsernameSecured(username);
  const newFound = await profile.findContactsByUserId(targetUser.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:profile_contact:all",
    newFound,
  );
  return response.status(200).json(secureOutputValues);
}
