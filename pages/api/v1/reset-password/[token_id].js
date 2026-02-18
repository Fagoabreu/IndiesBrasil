import controller from "@/infra/controller";
import activation from "@/models/activation";
import authorization from "@/models/authorization";
import { createRouter } from "next-connect";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.patch(controller.canRequest("read:activation_token"), patchHandler);

export default router.handler(controller.errorHandlers);

export async function patchHandler(request, response) {
  const userTryingToActivate = request.context.user;
  const tokenId = request.query.token_id;
  const { password } = request.body;
  const usedActivationToken = await activation.changePasswordByToken(tokenId, password);
  const secureOutputValues = authorization.filterOutput(userTryingToActivate, "read:activation_token", usedActivationToken);
  return response.status(201).json(secureOutputValues);
}
