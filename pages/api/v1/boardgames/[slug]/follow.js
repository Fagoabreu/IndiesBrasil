import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:boardgame:follow"), postHandler)
  .delete(controller.canRequest("create:boardgame:follow"), deleteHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const boardgameData = await boardgame.findBySlug(slug);
  await boardgame.followBoardgame(boardgameData.id, requestUser.id);

  return response.status(200).json({ following: true });
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const boardgameData = await boardgame.findBySlug(slug);
  await boardgame.unfollowBoardgame(boardgameData.id, requestUser.id);

  return response.status(200).json({ following: false });
}
