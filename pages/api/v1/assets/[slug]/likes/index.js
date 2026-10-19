import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import asset from "models/asset";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:asset:like"), postHandler)
  .handler(controller.errorHandlers);

/**
 * POST /api/v1/assets/[slug]/likes
 *
 * Curtir exige sessão (`create:asset:like`), exatamente como em jogos e livros:
 * o visitante lê o asset e vê a contagem, mas o botão leva ao login.
 */
async function postHandler(request, response) {
  const userTryingToLike = request.context.user;
  const { slug } = request.query;

  const assetData = await asset.findBySlug(slug);
  const result = await asset.setLikes(assetData.id, userTryingToLike.id, request.body?.liked);

  const secureOutputValues = authorization.filterOutput(userTryingToLike, "read:like", result);
  return response.status(201).json(secureOutputValues);
}
