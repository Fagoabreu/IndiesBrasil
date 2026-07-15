import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";
import { ForbiddenError, ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:game"), getHandler)
  .post(controller.canRequest("update:game"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const gameData = await game.findBySlug(slug);
  const media = await game.findMedia(gameData.id);
  return response.status(200).json(media);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const gameData = await game.findBySlug(slug);
  const canEdit = await game.canEdit(gameData, requestUser.id);
  if (!canEdit) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este jogo.",
    });
  }

  const { url, caption } = request.body;
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new ValidationError({ message: "URL é obrigatória." });
  }

  const entry = await game.addMedia(gameData.id, {
    media_type: "video",
    url: url.trim(),
    caption: caption?.trim() || null,
    display_order: 0,
  });
  return response.status(201).json(entry);
}
