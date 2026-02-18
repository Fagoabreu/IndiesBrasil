import { createRouter } from "next-connect";
import controller from "infra/controller";
import tags from "@/models/tags";
import authorization from "@/models/authorization";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:post"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const name = request.query.name;
  const limit = request.query.limit ?? 5;

  const tagList = await tags.getSuggestByName(name, limit);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:tag:all");
  return response.status(200).json(secureOutputValues);
}
