import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import serverStatus from "@/models/serverStatus";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const summary = await serverStatus.getSummary();
  return response.status(200).json(summary);
}
