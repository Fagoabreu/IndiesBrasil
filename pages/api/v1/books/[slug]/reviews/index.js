import { createRouter } from "next-connect";
import controller from "infra/controller";
import book from "models/book";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:book"), getHandler);
router.post(controller.canRequest("create:book:review"), postHandler);
router.patch(controller.canRequest("update:book:review"), patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug, page = 1, limit = 10 } = request.query;
  const bookData = await book.findBySlug(slug);
  const reviews = await book.getReviews(bookData.id, {
    page: Number(page),
    limit: Math.min(Number(limit), 20),
  });
  return response.status(200).json(reviews);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const bookData = await book.findBySlug(slug);
  const review = await book.createReview(bookData.id, requestUser.id, request.body);
  return response.status(201).json(review);
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { reviewId } = request.body;

  if (!reviewId) {
    return response.status(400).json({ message: "reviewId é obrigatório." });
  }

  const review = await book.updateReview(reviewId, requestUser.id, request.body);
  return response.status(200).json(review);
}
