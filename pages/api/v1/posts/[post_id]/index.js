import controller from "@/infra/controller.js";
import post from "@/models/post.js";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.delete(controller.canRequest("read:session"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const post_id = request.query.post_id;
  const author_id = request.context.user.id;
  const resultPost = await post.deletePostByIdAndAuthorId(author_id, post_id);
  return response.status(200).json(resultPost);
}
