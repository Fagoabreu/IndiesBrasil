import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import assetCategory from "models/assetCategory";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .delete(controller.canRequest("read:admin"), deleteHandler)
  .handler(controller.errorHandlers);

/**
 * PATCH /api/v1/asset-categories/[id]
 *
 * Inclui `is_active`: é assim que uma categoria em uso sai de circulação sem
 * perder a classificação dos assets que já a têm.
 */
async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const updated = await assetCategory.update(request.query.id, request.body);
  const secureOutputValues = authorization.filterOutput(requestUser, "read:asset_category", updated);

  return response.status(200).json(secureOutputValues);
}

/** DELETE responde 400 com a contagem quando a categoria está em uso. */
async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  const deleted = await assetCategory.deleteCategory(request.query.id);
  const secureOutputValues = authorization.filterOutput(requestUser, "read:asset_category", deleted);

  return response.status(200).json(secureOutputValues);
}
