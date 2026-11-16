import { createRouter } from "next-connect";
import controller from "infra/controller";
import gameGenreSuggestion from "models/gameGenreSuggestion";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:admin"), getHandler)
  .post(controller.canRequest("create:game_genre_suggestion"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/game-genre-suggestions?status=pending
 *
 * A fila é só do admin (é a curadoria), mas **sugerir** é de qualquer pessoa
 * autenticada — o conteúdo nasce de quem usa a plataforma.
 */
async function getHandler(request, response) {
  const status = typeof request.query.status === "string" ? request.query.status : "pending";
  const suggestions = await gameGenreSuggestion.findAll({ status });

  return response.status(200).json(suggestions);
}

/**
 * POST /api/v1/game-genre-suggestions — `{ name, justification?, game_id }`
 *
 * `game_id` é obrigatório: aprovada a sugestão, o gênero é vinculado ao jogo de
 * origem. Sem ele, a fila viraria um catálogo paralelo sem dono.
 */
async function postHandler(request, response) {
  const created = await gameGenreSuggestion.create(request.body, request.context.user.id);
  return response.status(201).json(created);
}
