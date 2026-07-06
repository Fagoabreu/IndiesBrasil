import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:studio"), respondHandler)
  .delete(controller.canRequest("create:studio:invitation"), cancelHandler)
  .handler(controller.errorHandlers);

async function respondHandler(request, response) {
  const { id } = request.query;
  const requestUser = request.context.user;

  if (!requestUser.id)
    throw new ForbiddenError({ message: "Autenticacao necessaria." });

  const { accept } = request.body;
  const result = await organization.respondToInvitation(
    id,
    requestUser.id,
    accept,
  );
  return response.status(200).json(result);
}

async function cancelHandler(request, response) {
  const { slug, id } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  await organization.cancelInvitation(id, requestUser.id, studio);
  return response.status(204).end();
}
