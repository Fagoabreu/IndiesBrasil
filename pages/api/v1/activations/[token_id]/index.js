import controller from "infra/controller.js";
import activation from "models/activation.js";
import { createRouter } from "next-connect";

const router = createRouter();

router.patch(patchHandler);

export default router.handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const activationTokenId = request.query.token_id;
  const validActivationToken =
    await activation.findOneValidById(activationTokenId);
  const usedActivationToken =
    await activation.markTokenAsUsed(activationTokenId);

  await activation.activateUserByUserId(validActivationToken.user_id);
  response.status(200).json(usedActivationToken);
}
