import controller from "@/infra/controller";
import post from "@/models/post";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:post"), postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const post_id = request.query.post_id;
  const user_id = request.context.user.id;
  const { liked } = request.body;

  const result = await post.setPostLikes(post_id, user_id, liked);
  return response.status(201).json(result);
}
