import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

// PATCH � aceitar ou recusar convite (pelo usu�rio convidado)
router.patch(controller.canRequest("read:studio"), respondHandler);

// DELETE � cancelar convite (pelo admin que enviou ou outro admin)
router.delete(controller.canRequest("create:studio:invitation"), cancelHandler);

export default router.handler(controller.errorHandlers);

async function respondHandler(request, response) {
  const { id } = request.query;
  const requestUser = request.context.user;

  if (!requestUser.id) throw new ForbiddenError({ message: "Autentica��o necess�ria." });

  const { accept } = request.body;
  const result = await organization.respondToInvitation(id, requestUser.id, accept);
  return response.status(200).json(result);
}

async function cancelHandler(request, response) {
  const { slug, id } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  await organization.cancelInvitation(id, requestUser.id, studio);
  return response.status(204).end();
}
