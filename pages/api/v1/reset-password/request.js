import user from "@/models/user";
import activation from "@/models/activation";

import { createRouter } from "next-connect";
import controller from "@/infra/controller";
import rateLimit from "lib/rate-limit.js";
import { NotFoundError } from "@/infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.rateLimitBy({ limiter: rateLimit.limiters.reset }), controller.canRequest("create:session"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userInputValues = request.body;
  try {
    const resetUser = await user.findOneByEmail(userInputValues.email);

    if (resetUser && resetUser.cpf === userInputValues.cpf) {
      const resetPasswordToken = await activation.create(resetUser.id);
      await activation.sendPasswordEmailToUser(resetUser, resetPasswordToken);
    }
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }
  }

  return response.status(200).json({
    message: "Se o email cadastrado existir junto ao CPF, enviaremos instruções.",
  });
}
