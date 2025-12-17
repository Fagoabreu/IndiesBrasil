import user from "@/models/user";
import activation from "@/models/activation";

import { createRouter } from "next-connect";
import controller from "@/infra/controller";
import { NotFoundError } from "@/infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:session"), postHandler);

export default router.handler(controller.errorHandlers);

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
