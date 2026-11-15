import { createRouter } from "next-connect";
import controller from "infra/controller";
import gameGenreSuggestion from "models/gameGenreSuggestion";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .handler(controller.errorHandlers);

/**
 * PATCH /api/v1/game-genre-suggestions/[id] — `{ status, parent_name? }`
 *
 * Aprovar cria o gênero e **vincula ao jogo de origem** na mesma chamada (regra
 * no model). `parent_name` decide se o gênero novo é de primeiro nível
 * (`null`) ou subgênero de um existente — é a única decisão que a sugestão não
 * pode tomar sozinha.
 */
async function patchHandler(request, response) {
  const reviewed = await gameGenreSuggestion.review(request.query.id, request.body, request.context.user.id);
  return response.status(200).json(reviewed);
}
