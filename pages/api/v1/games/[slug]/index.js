import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:game"), getHandler)
  .patch(controller.canRequest("update:game"), patchHandler)
  .delete(controller.canRequest("delete:game"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const gameData = await game.findBySlug(slug);

  const isFollowingGame = requestUser.id ? await game.isFollowing(gameData.id, requestUser.id) : false;

  const userReview = requestUser.id ? await game.getUserReview(gameData.id, requestUser.id) : null;

  const canEditGame = await game.canEdit(gameData, requestUser.id);

  return response.status(200).json({
    ...gameData,
    viewer: {
      isFollowing: isFollowingGame,
      canEdit: canEditGame,
      userReview,
    },
  });
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const gameData = await game.findBySlug(slug);
  const canEditGame = await game.canEdit(gameData, requestUser.id);

  if (!canEditGame) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este jogo.",
    });
  }

  const updated = await game.update(slug, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const gameData = await game.findBySlug(slug);
  const canEditGame = await game.canEdit(gameData, requestUser.id);

  if (!canEditGame) {
    throw new ForbiddenError({
      message: "Você não tem permissão para excluir este jogo.",
    });
  }

  await game.deleteGame(slug);
  return response.status(204).end();
}
