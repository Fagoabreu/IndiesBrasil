import { createRouter } from "next-connect";
import controller from "infra/controller";
import book from "models/book";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:book"), getHandler)
  .patch(controller.canRequest("update:book"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const bookData = await book.findBySlug(slug);
  const isFollowingBook = requestUser?.id ? await book.isFollowing(bookData.id, requestUser.id) : false;
  const canEditBook = await book.canEdit(bookData.id, requestUser);
  const userReview = requestUser?.id ? await book.getUserReview(bookData.id, requestUser.id) : null;

  return response.status(200).json({
    ...bookData,
    viewer: {
      isFollowing: isFollowingBook,
      canEdit: canEditBook,
      userReview,
    },
  });
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const bookData = await book.findBySlug(slug);
  const canEditBook = await book.canEdit(bookData.id, requestUser);

  if (!canEditBook) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este livro/quadrinho.",
    });
  }

  const updated = await book.update(slug, request.body);
  return response.status(200).json(updated);
}
