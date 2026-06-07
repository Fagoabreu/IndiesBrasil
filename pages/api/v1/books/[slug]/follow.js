import { createRouter } from "next-connect";
import controller from "infra/controller";
import book from "models/book";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.post(controller.canRequest("create:book:follow"), postHandler);
router.delete(controller.canRequest("create:book:follow"), deleteHandler);

export default router.handler(controller.errorHandlers);

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
