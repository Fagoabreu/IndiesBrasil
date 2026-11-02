import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import organization from "models/organization";
import service from "models/service";
import { ForbiddenError } from "infra/errors";
import { parseServiceFilter } from "lib/serviceFilters";
import { ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:studio"), listHandler)
  .post(controller.canRequest("create:studio"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { page = 1, limit = 20, search = "", isfollowing, member, service } = request.query;
  const requestUser = request.context.user;

  let studios;
  if (member === "me" && requestUser?.id) {
    studios = await organization.findByMember(requestUser.id);
  } else if (isfollowing === "true" && requestUser?.id) {
    studios = await organization.findFollowing(requestUser.id, {
      page: Number(page),
      limit: Number(limit),
      search,
    });
  } else {
    studios = await organization.findAll({
      page: Number(page),
      limit: Number(limit),
      search,
      service: await resolveServiceFilter(service),
    });
  }

  return response.status(200).json(studios);
}

/**
 * Confere que o serviço existe antes de filtrar.
 *
 * `parseServiceFilter` valida a **forma**; aqui é a existência. Slug bem
 * formado que não está no catálogo responderia lista vazia — e quem digitou
 * `portabilidade-mobille` concluiria que ninguém oferece o serviço, quando o
 * erro é de digitação. 400 diz o que aconteceu.
 */
async function resolveServiceFilter(raw) {
  const slug = parseServiceFilter(raw);
  if (!slug) return "";

  const found = await service.findBySlug(slug);

  if (!found) {
    throw new ValidationError({
      message: "Serviço não encontrado.",
      action: "Confira o endereço ou limpe o filtro de serviço.",
    });
  }

  return found.slug;
}

async function createHandler(request, response) {
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:studio")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para criar um estúdio.",
    });
  }

  const studio = await organization.create(requestUser, request.body);
  return response.status(201).json(studio);
}
