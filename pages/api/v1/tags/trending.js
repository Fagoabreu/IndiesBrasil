import { createRouter } from "next-connect";
import controller from "infra/controller";
import tags from "@/models/tags";
import authorization from "@/models/authorization";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:post"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const period = request.query.period ?? "7d";
  const limit = request.query.limit ?? 20;

  const tagList = await tags.getTrendingByPeriod(period, limit);
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "count:tag:all", tagList);
  return response.status(200).json(secureOutputValues);
}
