import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import assetCategory from "models/assetCategory";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:asset_category:all"), getHandler)
  .post(controller.canRequest("read:admin"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/asset-categories?include_inactive=true
 *
 * A taxonomia é pública (o filtro da listagem de assets precisa dela sem
 * sessão). As categorias **inativas** só aparecem para administradores: são
 * justamente as que saíram do ar.
 */
async function getHandler(request, response) {
  const requestUser = request.context.user;
  const includeInactive = request.query.include_inactive === "true";

  if (includeInactive && !authorization.can(requestUser, "read:admin")) {
    throw new ForbiddenError({
      message: "Acesso restrito a administradores.",
      action: "As categorias desativadas só podem ser vistas por administradores.",
    });
  }

  const categories = await assetCategory.findAll({ includeInactive });
  const secureOutputValues = authorization.filterOutput(requestUser, "read:asset_category:all", categories);

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const created = await assetCategory.create(request.body);
  const secureOutputValues = authorization.filterOutput(requestUser, "read:asset_category", created);

  return response.status(201).json(secureOutputValues);
}
