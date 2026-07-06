import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:studio:follow"), followHandler)
  .delete(controller.canRequest("create:studio:follow"), unfollowHandler)
  .handler(controller.errorHandlers);

async function requireAuth(requestUser) {
  if (!requestUser.id)
    throw new ForbiddenError({
      message: "Autenticação necessária para seguir um estúdio.",
    });
}

async function followHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  await requireAuth(requestUser);

  const studio = await organization.findBySlug(slug);
  await organization.followOrg(studio.id, requestUser.id);
  return response.status(204).end();
}

async function unfollowHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  await requireAuth(requestUser);

  const studio = await organization.findBySlug(slug);
  await organization.unfollowOrg(studio.id, requestUser.id);
  return response.status(204).end();
}
