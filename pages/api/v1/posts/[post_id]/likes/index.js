import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import post from "@/models/post";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:post"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToLike = request.context.user;
  const post_id = request.query.post_id;
  const user_id = request.context.user.id;
  const { liked } = request.body;

  const result = await post.setPostLikes(post_id, user_id, liked);
  const secureOutputValues = authorization.filterOutput(userTryingToLike, "read:like", result);
  return response.status(201).json(secureOutputValues);
}
