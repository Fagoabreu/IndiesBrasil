import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import notification from "@/models/notification";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:user"), getHandler)
  .patch(controller.canRequest("update:user"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const username = request.query.username;

  if (userTryingToGet.username !== username) {
    throw new ForbiddenError({
      message: "Você não tem permissão para acessar as notificações de outro usuário.",
      action: "Verifique se você possui a feature necessária para visualizar outro usuário",
    });
  }

  const notifications = await notification.findOrgNotificationsByUserId(userTryingToGet.id);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:org_notifications:all", notifications);
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToGet = request.context.user;
  const username = request.query.username;
  const { notification_id } = request.body;

  if (userTryingToGet.username !== username) {
    throw new ForbiddenError({
      message: "Você não tem permissão para acessar as notificações de outro usuário.",
      action: "Verifique se você possui a feature necessária para visualizar outro usuário",
    });
  }

  await notification.markOrgNotificationRead(notification_id, userTryingToGet.id);
  return response.status(200).json({ notification_id, is_read: true });
}
