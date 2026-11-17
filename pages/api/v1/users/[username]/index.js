import { createRouter } from "next-connect";
import controller from "infra/controller";
import user from "models/user";
import session from "models/session";
import authorization from "@/models/authorization";
import { ForbiddenError } from "@/infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:user"), getHandler)
  .patch(controller.canRequest("update:user"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToRequest = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsernameSecured(username);

  const secureOutputValues = authorization.filterOutput(userTryingToRequest, "read:user", userFound);

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsernameSecured(username);
  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar outro usuário.",
      action: "Verifique se você possui a feature necessária para atualizar outro usuário",
    });
  }

  // Troca de senha encerra as outras sessões (ver `user.update`). A sessão que
  // fez a troca é preservada: quem acabou de digitar a senha nova não deve ser
  // deslogado. Quando o admin troca a senha de OUTRA pessoa, `targetUser` não é
  // o dono da sessão atual e nada é preservado — o outro perde o acesso, que é
  // o comportamento desejado num reset administrativo.
  const keepSessionId =
    "password" in userInputValues && targetUser.id === userTryingToPatch.id ? await session.findIdByToken(request.cookies.session_id) : null;

  const updatedUser = await user.update(username, userInputValues, { exceptSessionId: keepSessionId });

  const secureOutputValues = authorization.filterOutput(userTryingToPatch, "read:user", updatedUser);

  return response.status(200).json(secureOutputValues);
}
