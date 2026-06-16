import { createRouter } from "next-connect";
import controller from "infra/controller";
import contentReview from "models/content-review";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:content_review:all"), getHandler);
router.post(controller.canRequest("create:content_review"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { page = 1, limit = 20, content_type = "" } = request.query;

  const reviews = await contentReview.findAll({
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    contentType: content_type,
  });

  return response.status(200).json(reviews);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { title, content_type, content_id, cover_image_id, cover_url, rating, sections, positive_points, negative_points } = request.body;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const review = await contentReview.create({
    title,
    authorId: requestUser.id,
    contentType: content_type,
    contentId: content_id,
    coverImageId: cover_image_id && UUID_REGEX.test(cover_image_id) ? cover_image_id : null,
    coverUrl: cover_url || null,
    rating,
    sections,
    positivePoints: positive_points,
    negativePoints: negative_points,
  });

  return response.status(201).json(review);
}
