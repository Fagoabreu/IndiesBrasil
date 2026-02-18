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
  const period = request.query.period ?? "7d";
  const limit = request.query.limit ?? 20;

  const tagList = await tags.getTrendingByPeriod(period, limit);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "count:tag:all", tagList);
  return response.status(200).json(secureOutputValues);
}
