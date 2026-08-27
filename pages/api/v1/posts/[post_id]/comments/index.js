import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import comment from "@/models/comment.js";

import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:post"), getHandler)
  .post(controller.canRequest("create:post"), postHandler)
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
