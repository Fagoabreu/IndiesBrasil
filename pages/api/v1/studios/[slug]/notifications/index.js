import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import notification from "models/notification";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:studio"), getHandler)
  .patch(controller.canRequest("read:studio"), patchHandler)
  .handler(controller.errorHandlers);

async function assertMember(studio, userId) {
  const isMember = await organization.isMember(studio.id, userId);
  if (!isMember) {
    throw new ForbiddenError({
      message: "Apenas membros do estúdio podem acessar as notificações.",
    });
  }
}

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  await assertMember(studio, requestUser.id);

  const notifications = await notification.findOrgNotificationsByOrgId(studio.id, requestUser.id);
  const secureOutputValues = authorization.filterOutput(requestUser, "read:org_notifications:all", notifications);
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  const { notification_id } = request.body;

  const studio = await organization.findBySlug(slug);
  await assertMember(studio, requestUser.id);

  await notification.markOrgNotificationRead(notification_id, requestUser.id);
  return response.status(200).json({ notification_id, is_read: true });
}
