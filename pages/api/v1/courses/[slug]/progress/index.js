import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course:progress"), getHandler)
  .post(controller.canRequest("create:course:progress"), markHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!requestUser?.id) {
    return response
      .status(200)
      .json({
        lessons: [],
        completedCount: 0,
        totalCount: 0,
        lastCompletedOrder: null,
        nextLessonOrder: null,
      });
  }

  const progress = await course.getCourseProgress(slug, requestUser.id);
  return response.status(200).json(progress);
}

async function markHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:course:progress")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para marcar progresso.",
    });
  }

  const { order, completed = true } = request.body;

  if (completed) {
    await course.markLessonCompleted(slug, order, requestUser.id);
  } else {
    await course.markLessonIncomplete(slug, order, requestUser.id);
  }

  const progress = await course.getCourseProgress(slug, requestUser.id);
  return response.status(200).json(progress);
}
