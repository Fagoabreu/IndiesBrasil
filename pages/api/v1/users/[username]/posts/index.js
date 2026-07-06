import { createRouter } from "next-connect";
import controller from "infra/controller";
import post from "models/post";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { username } = request.query;
  const viewer = request.context.user;
  const posts = await post.getPostsByUsername(viewer?.id ?? null, username);
  return response.status(200).json(posts);
}
