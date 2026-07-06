import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import profile from "@/models/profile";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:user"), patchHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const username = request.query.username;
  let userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsernameSecured(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action:
        "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  const postedHistory = await Promise.all(
    userInputValues.historicos.map(async (historyValues) => {
      return await profile.patchHistorico(historyValues);
    }),
  );
  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:profile_history:all",
    postedHistory,
  );
  return response.status(200).json(secureOutputValues);
}
