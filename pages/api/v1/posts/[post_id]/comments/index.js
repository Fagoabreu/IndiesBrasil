import controller from "@/infra/controller.js";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import comment from "@/models/comment.js";

import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:post"), getHandler)
  .post(controller.canRequest("create:post"), postHandler)
  .delete(controller.canRequest("create:post"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const post_id = request.query.post_id;
  const userTryingToGet = request.context.user;
  const user_id = userTryingToGet.id;
  const resultPost = await comment.getCommentsByPostId(post_id, user_id);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:comment:all", resultPost);

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const commentInputValues = request.body;
  const userTryingToPost = request.context.user;
  commentInputValues.author_id = userTryingToPost.id;
  commentInputValues.post_id = request.query.post_id;
  const createdComment = await comment.create(commentInputValues);
  const resultComment = {
    ...createdComment,
    author_username: request.context.user.username,
    is_current_user: true,
  };
  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:comment", resultComment);

  return response.status(201).json(secureOutputValues);
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
