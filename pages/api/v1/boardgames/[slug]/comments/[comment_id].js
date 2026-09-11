import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";
import { ForbiddenError, NotFoundError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("create:boardgame:comment"), deleteHandler)
  .handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const comment_id = request.query.comment_id;
  const user_id = request.context.user.id;

  const selectedComment = await boardgame.getCommentById(comment_id, user_id);
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

  await boardgame.deleteComment(comment_id);
  return response.status(204).end();
}
