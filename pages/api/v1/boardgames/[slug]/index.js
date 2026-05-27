import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:boardgame"), getHandler);
router.patch(controller.canRequest("update:boardgame"), patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const boardgameData = await boardgame.findBySlug(slug);
  const isFollowingBoardgame = requestUser.id ? await boardgame.isFollowing(boardgameData.id, requestUser.id) : false;
  const canEditBoardgame = await boardgame.canEdit(boardgameData.id, requestUser);
  const userReview = requestUser.id ? await boardgame.getUserReview(boardgameData.id, requestUser.id) : null;

  return response.status(200).json({
    ...boardgameData,
    viewer: {
      isFollowing: isFollowingBoardgame,
      canEdit: canEditBoardgame,
      userReview,
    },
  });
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const boardgameData = await boardgame.findBySlug(slug);
  const canEditBoardgame = await boardgame.canEdit(boardgameData.id, requestUser);

  if (!canEditBoardgame) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este jogo de mesa.",
    });
  }

  const updated = await boardgame.update(slug, request.body);
  return response.status(200).json(updated);
}
