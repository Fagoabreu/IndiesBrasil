import controller from "@/infra/controller.js";
import comment from "@/models/comment.js";

import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:post"), getHandler);
router.post(controller.canRequest("create:post"), postHandler);

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
  const resultComment = await comment.create(commentInputValues);
  return response.status(201).json(resultComment);
}
