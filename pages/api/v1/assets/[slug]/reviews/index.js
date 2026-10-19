import { createRouter } from "next-connect";
import controller from "infra/controller";
import asset from "models/asset";
import { ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:asset"), getHandler)
  .post(controller.canRequest("create:asset:review"), postHandler)
  .patch(controller.canRequest("update:asset:review"), patchHandler)
  .handler(controller.errorHandlers);

/** Leitura pública: o visitante sem sessão vê a nota média e as avaliações. */
async function getHandler(request, response) {
  const { slug, page = 1, limit = 10 } = request.query;

  const assetData = await asset.findBySlug(slug);
  const reviews = await asset.getReviews(assetData.id, {
    page: Number(page),
    limit: Math.min(Number(limit), 20),
  });

  return response.status(200).json(reviews);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const assetData = await asset.findBySlug(slug);
  const review = await asset.createReview(assetData.id, requestUser.id, request.body);

  return response.status(201).json(review);
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { reviewId } = request.body ?? {};

  if (!reviewId) {
    throw new ValidationError({ message: "reviewId é obrigatório." });
  }

  const review = await asset.updateReview(reviewId, requestUser.id, request.body);
  return response.status(200).json(review);
}
