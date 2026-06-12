import controller from "@/infra/controller.js";
import news from "@/models/news.js";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:news:factcheck"), postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const { news_id } = request.query;
  const userTryingToVote = request.context.user;
  const { vote } = request.body;

  if (!vote || !["factcheck", "fake"].includes(vote)) {
    return response.status(400).json({ error: "Voto deve ser 'factcheck' ou 'fake'." });
  }

  // Não pode votar na própria notícia
  const newsItem = await news.findById(news_id);
  if (newsItem.author_id === userTryingToVote.id) {
    return response.status(403).json({ error: "Você não pode votar na sua própria notícia." });
  }

  const result = await news.setFactcheck(news_id, userTryingToVote.id, vote);
  return response.status(200).json(result);
}
