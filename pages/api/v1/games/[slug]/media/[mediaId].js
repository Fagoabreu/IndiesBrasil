import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("update:game"), deleteHandler)
  .handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug, mediaId } = request.query;

  const gameData = await game.findBySlug(slug);
  const canEdit = await game.canEdit(gameData, requestUser.id);
  if (!canEdit) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este jogo.",
    });
  }

  await game.removeMedia(parseInt(mediaId, 10), gameData.id);
  return response.status(204).end();
}
