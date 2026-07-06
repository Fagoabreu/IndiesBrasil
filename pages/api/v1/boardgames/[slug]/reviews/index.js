import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:boardgame"), getHandler)
  .post(controller.canRequest("create:boardgame:review"), postHandler)
  .patch(controller.canRequest("update:boardgame:review"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug, page = 1, limit = 10 } = request.query;
  const bgData = await boardgame.findBySlug(slug);
  const reviews = await boardgame.getReviews(bgData.id, {
    page: Number(page),
    limit: Math.min(Number(limit), 20),
  });
  return response.status(200).json(reviews);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const bgData = await boardgame.findBySlug(slug);
  const review = await boardgame.createReview(
    bgData.id,
    requestUser.id,
    request.body,
  );
  return response.status(201).json(review);
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { reviewId } = request.body;

  if (!reviewId) {
    return response.status(400).json({ message: "reviewId é obrigatório." });
  }

  const review = await boardgame.updateReview(
    reviewId,
    requestUser.id,
    request.body,
  );
  return response.status(200).json(review);
}
