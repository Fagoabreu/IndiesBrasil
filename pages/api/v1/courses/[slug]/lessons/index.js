import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course:lesson"), listHandler)
  .post(controller.canRequest("create:course:lesson"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { slug } = request.query;

  const lessons = await course.findLessonsByCourseSlug(slug);
  return response.status(200).json(lessons);
}

async function createHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:course:lesson")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para criar aulas.",
    });
  }

  const lesson = await course.createLesson(slug, requestUser.id, request.body);
  return response.status(201).json(lesson);
}
