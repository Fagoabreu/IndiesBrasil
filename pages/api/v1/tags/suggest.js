import { createRouter } from "next-connect";
import controller from "infra/controller";
import tags from "@/models/tags";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:post"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const name = request.query.name;
  const limit = request.query.limit ?? 5;

  const tagList = await tags.getSuggestByName(name, limit);
  return response.status(200).json(tagList);
}
