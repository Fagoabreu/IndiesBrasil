import { createRouter } from "next-connect";
import controller from "infra/controller";
import asset from "models/asset";
import { ForbiddenError, NotFoundError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("create:asset:comment"), deleteHandler)
  .handler(controller.errorHandlers);

/** DELETE /api/v1/assets/[slug]/comments/[comment_id] — só o autor apaga. */
async function deleteHandler(request, response) {
  const { comment_id: commentId } = request.query;
  const userId = request.context.user.id;

  const selectedComment = await asset.getCommentById(commentId, userId);

  if (!selectedComment) {
    throw new NotFoundError({
      message: "O comentário informado não foi encontrado no sistema.",
      action: "Verifique se o comentário ainda existe.",
    });
  }

  if (selectedComment.is_current_user === false) {
    throw new ForbiddenError({
      message: "Você não tem permissão para deletar este comentário.",
    });
  }

  await asset.deleteComment(commentId);
  return response.status(204).end();
}
