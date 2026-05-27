import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";
import { ForbiddenError, ValidationError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:boardgame"), getHandler);
router.post(controller.canRequest("update:boardgame"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const boardgameData = await boardgame.findBySlug(slug);
  const media = await boardgame.findMedia(boardgameData.id);
  return response.status(200).json(media);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const boardgameData = await boardgame.findBySlug(slug);
  const canEdit = await boardgame.canEdit(boardgameData.id, requestUser);
  if (!canEdit) {
    throw new ForbiddenError({ message: "Você não tem permissão para editar este jogo de mesa." });
  }

  const { url, caption } = request.body;
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new ValidationError({ message: "URL é obrigatória." });
  }

  const entry = await boardgame.addMedia(boardgameData.id, {
    media_type: "video",
    url: url.trim(),
    caption: caption?.trim() || null,
    display_order: 0,
  });
  return response.status(201).json(entry);
}
