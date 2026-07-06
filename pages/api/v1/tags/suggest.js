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
  const name = request.query.name;
  const limit = request.query.limit ?? 5;

  const tagList = await tags.getSuggestByName(name, limit);
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:tag:all",
    tagList,
  );
  return response.status(200).json(secureOutputValues);
}
