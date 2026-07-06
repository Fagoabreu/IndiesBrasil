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

  const courseData = await course.findBySlug(slug);
  const tags = await course.getCourseTags(courseData.id);
  const lessons = await course.findLessonsByCourseSlug(slug);

  let viewer = null;
  if (requestUser?.id) {
    const [userRating, progress] = await Promise.all([
      course.getUserRating(slug, requestUser.id),
      course.getCourseProgress(slug, requestUser.id),
    ]);
    viewer = {
      isOwner: courseData.owner_id === requestUser.id,
      userRating: userRating?.rating || null,
      review: userRating?.review || null,
      progress,
    };
  }

  return response.status(200).json({
    ...courseData,
    tags,
    lessons,
    viewer,
  });
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
