import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";
import { parseAiLevelFilter, parseContentRatingFilter } from "lib/productFilters";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:boardgame:all"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { page = 1, limit = 20, search = "", category = "", stage = "", isfollowing, content_rating, ai_level } = request.query;
  const requestUser = request.context.user;

  if (isfollowing === "true" && requestUser.id) {
    const boardgames = await boardgame.findFollowedBy(requestUser.id);
    return response.status(200).json(boardgames);
  }

  const boardgames = await boardgame.findAll({
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    search,
    category,
    stage,
    contentRating: parseContentRatingFilter(content_rating),
    aiLevel: parseAiLevelFilter(ai_level),
  });
  return response.status(200).json(boardgames);
}
