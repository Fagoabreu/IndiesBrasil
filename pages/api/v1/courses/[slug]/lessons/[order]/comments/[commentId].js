import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:course:comment"), patchHandler)
  .delete(controller.canRequest("delete:course:comment"), deleteHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const { slug, order, commentId } = request.query;
  const requestUser = request.context.user;
  const { content } = request.body;

  const updated = await course.updateLessonComment(slug, order, commentId, requestUser.id, content);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const { slug, order, commentId } = request.query;
  const requestUser = request.context.user;

  await course.deleteLessonComment(slug, order, commentId, requestUser.id);
  return response.status(204).end();
}
