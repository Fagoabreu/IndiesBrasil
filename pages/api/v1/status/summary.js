import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import serverStatus from "@/models/serverStatus";
import authorization from "@/models/authorization";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const summary = await serverStatus.getSummary();
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:summary", summary);
  return response.status(200).json(secureOutputValues);
}
