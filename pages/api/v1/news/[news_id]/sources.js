import controller from "@/infra/controller.js";
import news from "@/models/news.js";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(getHandler);
router.post(controller.canRequest("create:news"), postHandler);
router.delete(controller.canRequest("create:news"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { news_id } = request.query;
  const sources = await news.getSources(news_id);
  return response.status(200).json(sources);
}

async function postHandler(request, response) {
  const { news_id } = request.query;
  const { url, label } = request.body;

  if (!url) {
    return response.status(400).json({ error: "URL é obrigatória." });
  }

  const created = await news.addSource(news_id, url, label || null);
  return response.status(201).json(created);
}

async function deleteHandler(request, response) {
  const { source_id } = request.query;
  await news.deleteSource(source_id);
  return response.status(204).end();
}
