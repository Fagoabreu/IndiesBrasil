import controller from "@/infra/controller.js";
import post from "@/models/post.js";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:post"), postHandler);
router.get(controller.canRequest("read:post"), getHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userInputValues = request.body;
  userInputValues.author_id = request.context.user.id;

  const createdPost = await post.create(userInputValues);
  const resultPost = await post.getPostById(userInputValues.author_id, createdPost.id);
  response.setHeader("Cache-Control", "no-store,no-cache-max-age=0,must-revalidate");
  return response.status(200).json(resultPost);
}

async function getHandler(request, response) {
  const userId = request.context.user.id;
  const posts = await post.getPosts(userId);
  response.setHeader("Cache-Control", "no-store,no-cache-max-age=0,must-revalidate");
  return response.status(200).json(posts);
}
