import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import notification from "@/models/notification";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);
router.patch(controller.canRequest("update:user"), patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const username = request.query.username;

  if (userTryingToGet.username !== username) {
    throw new ForbiddenError({
      message: "Você não tem permissão para acessar as notificações de outro usuário.",
      action: "Verifique se você possui a feature necessária para visualizar outro usuário",
    });
  }

  const notifications = await notification.findUserNotificationsByUserId(userTryingToGet.id);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:user_notifications:all", notifications);
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToGet = request.context.user;
  const username = request.query.username;
  const userInputValues = request.body;

  if (userTryingToGet.username !== username) {
    throw new ForbiddenError({
      message: "Você não tem permissão para acessar as notificações de outro usuário.",
      action: "Verifique se você possui a feature necessária para visualizar outro usuário",
    });
  }

  const notifications = await notification.updateUserNotification(userInputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:user_notifications:all", notifications);
  return response.status(200).json(secureOutputValues);
}
