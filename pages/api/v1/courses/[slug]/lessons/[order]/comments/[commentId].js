import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.patch(controller.canRequest("update:course:comment"), patchHandler);
router.delete(controller.canRequest("delete:course:comment"), deleteHandler);

export default router.handler(controller.errorHandlers);

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
