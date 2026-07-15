import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:game:all"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { page = 1, limit = 20, search = "", genre = "", stage = "", isfollowing } = request.query;
  const requestUser = request.context.user;

  if (isfollowing === "true" && requestUser.id) {
    const games = await game.findFollowedBy(requestUser.id);
    return response.status(200).json(games);
  }

  const games = await game.findAll({
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    search,
    genre,
    stage,
  });
  return response.status(200).json(games);
}
