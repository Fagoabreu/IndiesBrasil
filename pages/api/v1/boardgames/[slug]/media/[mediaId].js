import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .delete(controller.canRequest("update:boardgame"), deleteHandler)
  .handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const { slug, mediaId } = request.query;

  const boardgameData = await boardgame.findBySlug(slug);
  const canEdit = await boardgame.canEdit(boardgameData.id, requestUser);
  if (!canEdit) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este jogo de mesa.",
    });
  }

  await boardgame.removeMedia(parseInt(mediaId, 10), boardgameData.id);
  return response.status(204).end();
}
