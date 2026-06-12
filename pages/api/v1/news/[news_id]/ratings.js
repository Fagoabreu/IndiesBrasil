import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import news from "@/models/news.js";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:news:rating"), postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const { news_id } = request.query;
  const userTryingToRate = request.context.user;
  const { rating } = request.body;

  if (!rating || rating < 1 || rating > 5) {
    return response.status(400).json({ error: "Rating deve ser entre 1 e 5." });
  }

  // Não pode avaliar a própria notícia
  const newsItem = await news.findById(news_id);
  if (newsItem.author_id === userTryingToRate.id) {
    return response.status(403).json({ error: "Você não pode avaliar sua própria notícia." });
  }

  const result = await news.setRating(news_id, userTryingToRate.id, rating);
  const secureOutput = authorization.filterOutput(userTryingToRate, "create:news:rating", result);
  return response.status(200).json(secureOutput);
}
