import controller from "@/infra/controller.js";
import { ForbiddenError } from "@/infra/errors";
import comment from "@/models/comment.js";

import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:post"), getHandler);
router.post(controller.canRequest("create:post"), postHandler);
router.delete(controller.canRequest("create:post"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const post_id = request.query.post_id;
  const user_id = request.context.user.id;
  const resultPost = await comment.getCommentsByPostId(post_id, user_id);
  return response.status(200).json(resultPost);
}

async function postHandler(request, response) {
  const commentInputValues = request.body;
  commentInputValues.author_id = request.context.user.id;
  commentInputValues.post_id = request.query.post_id;
  const createdComment = await comment.create(commentInputValues);
  const resultComment = {
    ...createdComment,
    author_username: request.context.user.username,
    is_current_user: true,
  };
  return response.status(201).json(resultComment);
}

async function deleteHandler(request, response) {
  const comment_id = request.query.comment_id;
  const user_id = request.context.user.id;
  const resultPost = await comment.getCommentsByCommentId(comment_id, user_id);
  if (resultPost.author_id !== user_id) {
    return new ForbiddenError("Você não tem permissão para deletar este comentário");
  }

  await comment.deleteById(comment_id);
  return response.status(204).end({ action: "removed" });
}
