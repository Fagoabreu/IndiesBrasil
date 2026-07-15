import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import tool from "@/models/tool";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("read:admin"), deleteHandler)
  .handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const tool_id = request.query.tool_id;
  const postToDelete = await tool.deleteTool(tool_id);
  const secureOutputValues = authorization.filterOutput(userTryingToDelete, "read:tool", postToDelete);
  return response.status(200).json(secureOutputValues);
}
