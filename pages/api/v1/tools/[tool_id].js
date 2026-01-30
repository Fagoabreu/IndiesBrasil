import controller from "@/infra/controller.js";
import tool from "@/models/tool";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.delete(controller.canRequest("read:admin"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const tool_id = request.query.tool_id;
  const postToDelete = await tool.deleteType(tool_id);
  return response.status(200).json(postToDelete);
}
