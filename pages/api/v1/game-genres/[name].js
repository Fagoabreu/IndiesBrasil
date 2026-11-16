import { createRouter } from "next-connect";
import controller from "infra/controller";
import gameGenre from "models/gameGenre";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .delete(controller.canRequest("read:admin"), deleteHandler)
  .handler(controller.errorHandlers);

/**
 * `[name]` vem na URL, não no corpo: renomear usa o nome antigo como chave, e o
 * `ON UPDATE CASCADE` leva a mudança aos vínculos dos jogos.
 */
async function patchHandler(request, response) {
  const name = decodeURIComponent(String(request.query.name));
  const updated = await gameGenre.update(name, request.body);
  return response.status(200).json(updated);
}

/**
 * Gênero em uso responde **400 com a contagem** (regra no model): excluir
 * apagaria a classificação de jogos existentes. Para aposentar, desative.
 */
async function deleteHandler(request, response) {
  const name = decodeURIComponent(String(request.query.name));
  const removed = await gameGenre.deleteGenre(name);
  return response.status(200).json(removed);
}
