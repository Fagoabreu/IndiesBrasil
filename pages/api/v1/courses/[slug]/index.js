import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course"), getHandler)
  .patch(controller.canRequest("update:course"), patchHandler)
  .delete(controller.canRequest("delete:course"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  // A montagem (tags, aulas, viewer) vive no model para a página do curso, que
  // agora renderiza no servidor, produzir exatamente o mesmo objeto.
  const fullCourse = await course.findFullBySlug(slug, requestUser?.id || null);

  return response.status(200).json(fullCourse);
}

async function patchHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "update:course")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para editar cursos.",
    });
  }

  const updated = await course.update(slug, requestUser.id, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "delete:course")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para remover cursos.",
    });
  }

  await course.remove(slug, requestUser.id);
  return response.status(204).end();
}
