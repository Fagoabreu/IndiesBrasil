import { createRouter } from "next-connect";
import controller from "infra/controller";
import contentReview from "models/content-review";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:content_review"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { content_type, content_id, page = 1, limit = 10 } = request.query;

  if (!content_type || !content_id) {
    return response.status(400).json({ message: "content_type e content_id são obrigatórios." });
  }

  const reviews = await contentReview.findByContent({
    contentType: content_type,
    contentId: content_id,
    page: Number(page),
    limit: Math.min(Number(limit), 20),
  });

  return response.status(200).json(reviews);
}
