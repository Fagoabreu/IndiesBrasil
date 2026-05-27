import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:boardgame:all"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { page = 1, limit = 20, search = "", category = "", stage = "", isfollowing } = request.query;
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
  });
  return response.status(200).json(boardgames);
}
