import controller from "@/infra/controller";
import activation from "@/models/activation";
import { createRouter } from "next-connect";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.patch(controller.canRequest("read:activation_token"), patchHandler);

export default router.handler(controller.errorHandlers);

export async function patchHandler(request, response) {
  const tokenId = request.query.token_id;
  const { password } = request.body;
  const usedActivationToken = await activation.changePasswordByToken(tokenId, password);
  return response.status(201).json(usedActivationToken);
}
