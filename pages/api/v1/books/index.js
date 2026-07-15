import { createRouter } from "next-connect";
import controller from "infra/controller";
import book from "models/book";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:book:all"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { page = 1, limit = 20, search = "", book_type = "", stage = "", isfollowing } = request.query;
  const requestUser = request.context.user;

  if (isfollowing === "true" && requestUser?.id) {
    const books = await book.findFollowedBy(requestUser.id);
    return response.status(200).json(books);
  }

  const books = await book.findAll({
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    search,
    book_type,
    stage,
  });
  return response.status(200).json(books);
}
