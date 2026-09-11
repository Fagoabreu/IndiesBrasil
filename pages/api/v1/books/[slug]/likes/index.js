import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import book from "models/book";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:book:like"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToLike = request.context.user;
  const { slug } = request.query;
  const { liked } = request.body;

  const bookData = await book.findBySlug(slug);
  const result = await book.setLikes(bookData.id, userTryingToLike.id, liked);

  const secureOutputValues = authorization.filterOutput(userTryingToLike, "read:like", result);
  return response.status(201).json(secureOutputValues);
}
