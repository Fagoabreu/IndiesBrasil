import controller from "@/infra/controller";
import reputation from "@/models/reputation";
import user from "@/models/user";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:user"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { username } = request.query;
  const reader = request.context.user;
  const targetUser = await user.findOneByUsernameSecured(username);

  const payload = {
    reputation: targetUser.reputation ?? 0,
  };

  // O histórico detalhado é privado: apenas o próprio usuário (ou um admin)
  // pode ver como sua pontuação foi construída. Demais visitantes veem só o
  // total público, que já aparece no perfil.
  const isSelf = reader.id === targetUser.id;
  const isAdmin = Array.isArray(reader.features) && reader.features.includes("read:admin");

  if (isSelf || isAdmin) {
    const events = await reputation.findByUserId(targetUser.id, { limit: 50 });
    payload.events = events;
  }

  return response.status(200).json(payload);
}
