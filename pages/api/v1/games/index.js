import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:game:all"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { page = 1, limit = 20, search = "", genre = "", stage = "" } = request.query;
  const games = await game.findAll({
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    search,
    genre,
    stage,
  });
  return response.status(200).json(games);
}
