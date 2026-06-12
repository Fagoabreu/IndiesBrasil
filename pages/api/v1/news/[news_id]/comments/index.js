import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import news from "@/models/news.js";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(getHandler);
router.post(controller.canRequest("create:news:comment"), postHandler);
router.delete(controller.canRequest("create:news:comment"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { news_id } = request.query;
  const comments = await news.getComments(news_id);
  return response.status(200).json(comments);
}

async function postHandler(request, response) {
  const { news_id } = request.query;
  const userTryingToComment = request.context.user;
  const { content } = request.body;

  if (!content || !content.trim()) {
    return response.status(400).json({ error: "Comentário não pode estar vazio." });
  }

  const created = await news.createComment(news_id, userTryingToComment.id, content);
  return response.status(201).json(created);
}

async function deleteHandler(request, response) {
  const { news_id, comment_id } = request.query;
  const userTryingToDelete = request.context.user;

  // Busca o comentário para verificar se é o autor
  const comments = await news.getComments(news_id);
  const comment = comments.find((c) => c.id === Number(comment_id));

  if (!comment) {
    return response.status(404).json({ error: "Comentário não encontrado." });
  }

  if (comment.author_id !== userTryingToDelete.id) {
    return response.status(403).json({ error: "Você não pode deletar este comentário." });
  }

  await news.deleteComment(comment_id);
  return response.status(204).end();
}
