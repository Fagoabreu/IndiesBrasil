import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.delete(controller.canRequest("update:studio"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const { slug, id } = request.query;
  const requestUser = request.context.user;

  const studio = await organization.findBySlug(slug);
  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  if (!isAdmin && studio.owner_id !== requestUser.id) {
    throw new ForbiddenError({ message: "Apenas administradores do estúdio podem remover contatos." });
  }

  await organization.deleteContact(Number(id), studio.id);
  return response.status(204).end();
}
