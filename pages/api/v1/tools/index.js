import controller from "@/infra/controller.js";
import tool from "@/models/tool";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:session"), getHandler);
router.post(controller.canRequest("read:admin"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const selectedContactTypes = await tool.findAllTool();
  return response.status(200).json(selectedContactTypes);
}

async function postHandler(request, response) {
  const inputValues = request.body;
  const insertedContactType = await tool.createTool(inputValues);
  return response.status(200).json(insertedContactType);
}
