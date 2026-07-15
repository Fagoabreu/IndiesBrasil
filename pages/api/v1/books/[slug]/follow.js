import { createRouter } from "next-connect";
import controller from "infra/controller";
import book from "models/book";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:book:follow"), postHandler)
  .delete(controller.canRequest("create:book:follow"), deleteHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const bookData = await book.findBySlug(slug);
  await book.followBook(bookData.id, requestUser.id);

  return response.status(200).json({ following: true });
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const bookData = await book.findBySlug(slug);
  await book.unfollowBook(bookData.id, requestUser.id);

  return response.status(200).json({ following: false });
}
