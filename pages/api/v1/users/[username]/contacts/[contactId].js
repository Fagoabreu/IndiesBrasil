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
  const contactId = request.query.contactId;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  userInputValues.id = contactId;
  const postedContact = await profile.patchContacts(userInputValues);
  return response.status(200).json(postedContact);
}

async function deleteHandler(request, response) {
  const username = request.query.username;
  const contactId = request.query.contactId;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const postedContact = await profile.deleteContatoById(contactId);
  return response.status(200).json(postedContact);
}
