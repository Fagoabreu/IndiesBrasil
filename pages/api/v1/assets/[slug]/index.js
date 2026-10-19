import { createRouter } from "next-connect";
import controller from "infra/controller";
import asset from "models/asset";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:asset"), getHandler)
  .patch(controller.canRequest("update:asset"), patchHandler)
  .delete(controller.canRequest("delete:asset"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const assetData = await asset.findBySlug(slug);
  const canEdit = await asset.canEdit(assetData.id, requestUser);

  // Interação exige sessão: o visitante lê a página, a contagem e as
  // avaliações, mas curtir/comentar/avaliar fica para quem está logado —
  // mesma regra de jogos e livros.
  const userReview = requestUser?.id ? await asset.getUserReview(assetData.id, requestUser.id) : null;
  const likedByUser = requestUser?.id ? await asset.isLiked(assetData.id, requestUser.id) : false;

  return response.status(200).json({
    ...assetData,
    viewer: {
      canEdit,
      userReview,
      likedByUser,
      likesCount: Number(assetData.likes_count ?? 0),
      commentsCount: Number(assetData.comments_count ?? 0),
    },
  });
}

async function patchHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const assetData = await asset.findBySlug(slug);

  if (!(await asset.canEdit(assetData.id, requestUser))) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este asset.",
    });
  }

  const updated = await asset.update(slug, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const assetData = await asset.findBySlug(slug);

  if (!(await asset.canEdit(assetData.id, requestUser))) {
    throw new ForbiddenError({
      message: "Você não tem permissão para excluir este asset.",
    });
  }

  await asset.deleteAsset(slug);
  return response.status(204).end();
}
