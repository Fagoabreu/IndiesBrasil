import { createRouter } from "next-connect";
import controller from "infra/controller";
import asset from "models/asset";
import assetCategory from "models/assetCategory";
import { isValidGroupKey, ASSET_GROUP_KEYS } from "lib/assetGroups";
import { ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:asset:all"), getHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/assets?page=&limit=&search=&category=&group=&free=
 *
 * Filtro inválido responde **400** em vez de cair na lista inteira: um
 * `?group=arte` (sem o `-2d`) devolvendo tudo faria o filtro parecer aplicado —
 * mesmo raciocínio de `?sort=` desconhecido em `/api/v1/users`.
 */
async function getHandler(request, response) {
  const { page = 1, limit = 20, search = "", category = "", group = "", free } = request.query;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNumber = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);

  let freeFilter = null;
  if (free !== undefined && free !== "") {
    if (free !== "true" && free !== "false") {
      throw new ValidationError({
        message: 'Parâmetro "free" inválido.',
        action: 'Use "true" ou "false".',
      });
    }
    freeFilter = free === "true";
  }

  if (group && !isValidGroupKey(group)) {
    throw new ValidationError({
      message: "Grupo de assets inválido.",
      action: `Informe um dos grupos: ${ASSET_GROUP_KEYS.join(", ")}.`,
    });
  }

  if (category) {
    const found = await assetCategory.findBySlug(category);
    if (!found || !found.is_active) {
      throw new ValidationError({
        message: "Categoria de asset não encontrada.",
        action: "Confira o endereço ou limpe o filtro de categoria.",
      });
    }
  }

  const assets = await asset.findAll({
    page: pageNumber,
    limit: limitNumber,
    search,
    category,
    group,
    free: freeFilter,
  });

  return response.status(200).json(assets);
}
