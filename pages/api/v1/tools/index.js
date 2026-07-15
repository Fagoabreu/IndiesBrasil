import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import tool from "@/models/tool";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:session"), getHandler)
  .post(controller.canRequest("read:admin"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const selectedTools = await tool.findAllTool();
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:tool:all", selectedTools);
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const inputValues = request.body;
  const insertedTool = await tool.createTool(inputValues);
  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:tool", insertedTool);
  return response.status(200).json(secureOutputValues);
}
