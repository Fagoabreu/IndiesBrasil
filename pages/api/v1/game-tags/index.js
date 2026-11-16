import { createRouter } from "next-connect";
import controller from "infra/controller";
import gameTag from "models/gameTag";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:game:all"), getHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/game-tags?popular=true&limit=20
 *
 * Alimenta o seletor de tag da listagem de jogos. Só conta tags que aparecem em
 * `game_tags`: uma tag que existe apenas em posts não é vocabulário de jogo.
 *
 * A rota é pública porque a listagem monta as opções no servidor — o HTML
 * servido precisa trazer os filtros reais.
 */
async function getHandler(request, response) {
  const rawLimit = Number.parseInt(request.query.limit, 10);
  const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 50);

  const tags = await gameTag.findPopular(limit);
  return response.status(200).json(tags);
}
