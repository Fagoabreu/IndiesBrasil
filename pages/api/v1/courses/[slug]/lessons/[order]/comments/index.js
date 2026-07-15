import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course:comment"), listHandler)
  .post(controller.canRequest("create:course:comment"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { slug, order } = request.query;

  const comments = await course.findLessonComments(slug, order);
  return response.status(200).json(comments);
}

async function createHandler(request, response) {
  const { slug, order } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:course:comment")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para comentar nas aulas.",
    });
  }

  const { content } = request.body;
  const comment = await course.createLessonComment(slug, order, requestUser.id, content);
  return response.status(201).json(comment);
}
