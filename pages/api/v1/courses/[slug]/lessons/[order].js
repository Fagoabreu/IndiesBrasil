import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:course:lesson"), getHandler);
router.patch(controller.canRequest("update:course:lesson"), patchHandler);
router.delete(controller.canRequest("delete:course:lesson"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug, order } = request.query;

  const lesson = await course.findLessonByOrder(slug, order);
  return response.status(200).json(lesson);
}

async function patchHandler(request, response) {
  const { slug, order } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "update:course:lesson")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para editar aulas.",
    });
  }

  const updated = await course.updateLesson(slug, order, requestUser.id, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const { slug, order } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "delete:course:lesson")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para remover aulas.",
    });
  }

  await course.deleteLesson(slug, order, requestUser.id);
  return response.status(204).end();
}
