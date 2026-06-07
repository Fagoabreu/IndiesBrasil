import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.post(controller.canRequest("create:game:follow"), postHandler);
router.delete(controller.canRequest("create:game:follow"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const gameData = await game.findBySlug(slug);
  await game.followGame(gameData.id, requestUser.id);

  return response.status(200).json({ following: true });
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const gameData = await game.findBySlug(slug);
  await game.unfollowGame(gameData.id, requestUser.id);

  return response.status(200).json({ following: false });
}
