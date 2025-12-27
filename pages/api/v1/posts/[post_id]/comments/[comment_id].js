import controller from "@/infra/controller.js";
import { ForbiddenError } from "@/infra/errors";
import comment from "@/models/comment.js";

import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.delete(controller.canRequest("create:post"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const comment_id = request.query.comment_id;
  const user_id = request.context.user.id;
  const selectedComment = await comment.getCommentsByCommentId(comment_id, user_id);
  if (selectedComment.is_current_user === false) {
    return new ForbiddenError("Você não tem permissão para deletar este comentário");
  }
  console.log("Permission granted to delete comment:", comment_id);
  await comment.deleteById(comment_id);
  return response.status(204).end();
}
