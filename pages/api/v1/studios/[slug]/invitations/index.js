import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import user from "models/user";
import notification from "models/notification";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:studio:invitation"), listHandler);
router.post(controller.canRequest("create:studio:invitation"), createHandler);

export default router.handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);

  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  if (!isAdmin && studio.owner_id !== requestUser.id) {
    throw new ForbiddenError({ message: "Apenas administradores podem ver os convites." });
  }

  const invitations = await organization.findPendingInvitations(studio.id);
  return response.status(200).json(invitations);
}

async function createHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);

  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  if (!isAdmin && studio.owner_id !== requestUser.id) {
    throw new ForbiddenError({ message: "Apenas administradores podem convidar membros." });
  }

  const { username: invitedUsername, role, message } = request.body;
  const invitedUser = await user.findOneByUsername(invitedUsername);

  const invitation = await organization.createInvitation(studio.id, invitedUser.id, requestUser.id, {
    role,
    message,
  });

  // Notifica o convidado de forma assíncrona
  notification
    .createUserNotification({
      user_id: invitedUser.id,
      type: "studio_invitation",
      source_user_id: requestUser.id,
      org_slug: slug,
    })
    .catch((err) => console.error("[invitation] erro ao criar notificação:", err?.message));

  return response.status(201).json(invitation);
}
