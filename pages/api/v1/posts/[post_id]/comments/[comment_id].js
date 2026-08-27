import controller from "@/infra/controller.js";
import { ForbiddenError, NotFoundError } from "@/infra/errors";
import comment from "@/models/comment.js";

import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("create:post"), deleteHandler)
  .handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const comment_id = request.query.comment_id;
  const user_id = request.context.user.id;
  const selectedComment = await comment.getCommentsByCommentId(comment_id, user_id);
  if (!selectedComment) {
    throw new NotFoundError({
      message: "O comentário informado não foi encontrado no sistema.",
      action: "Verifique se o comentário ainda existe.",
    });
  }
  if (selectedComment.is_current_user === false) {
    throw new ForbiddenError({
      message: "Você não tem permissão para deletar este comentário",
    });
  }
  await comment.deleteById(comment_id);
  return response.status(204).end();
}
