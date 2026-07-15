import { createRouter } from "next-connect";
import controller from "infra/controller";
import contentReview from "models/content-review";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:content_review"), getHandler)
  .patch(controller.canRequest("update:content_review"), patchHandler)
  .delete(controller.canRequest("delete:content_review"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const review = await contentReview.findBySlug(slug);
  return response.status(200).json(review);
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const review = await contentReview.findBySlug(slug);
  const updated = await contentReview.update(review.id, requestUser.id, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const review = await contentReview.findBySlug(slug);
  await contentReview.delete(review.id, requestUser.id);
  return response.status(204).end();
}
