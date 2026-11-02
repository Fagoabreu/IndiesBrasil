import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import service from "models/service";
import { ForbiddenError, ValidationError } from "infra/errors";
import { SERVICE_GROUP_KEYS, isValidServiceGroup } from "lib/serviceGroups";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:service:all"), getHandler)
  .post(controller.canRequest("read:admin"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/services?include_inactive=true&group=qualidade
 *
 * O catálogo é público (a listagem de estúdios precisa dele sem sessão). Os
 * serviços **inativos** só aparecem para administradores: são justamente os que
 * saíram do ar.
 *
 * `group` desconhecido responde 400 em vez de devolver tudo — cair no padrão
 * faria `?group=arte` parecer aplicado (mesmo raciocínio do filtro de assets).
 */
async function getHandler(request, response) {
  const requestUser = request.context.user;
  const includeInactive = request.query.include_inactive === "true";
  const group = typeof request.query.group === "string" ? request.query.group.trim() : "";

  if (includeInactive && !authorization.can(requestUser, "read:admin")) {
    throw new ForbiddenError({
      message: "Acesso restrito a administradores.",
      action: "Os serviços desativados só podem ser vistos por administradores.",
    });
  }

  if (group && !isValidServiceGroup(group)) {
    throw new ValidationError({
      message: "Grupo de serviço inválido.",
      action: `Informe um dos grupos: ${SERVICE_GROUP_KEYS.join(", ")}.`,
    });
  }

  const services = await service.findAll({ includeInactive, group });

  // O catálogo não tem dado sensível: a resposta inteira é pública. Ainda assim
  // passa por `filterOutput` quando há um recurso declarado — hoje não há, e
  // listar explicitamente seria mentira. Devolvemos como veio do banco.
  return response.status(200).json(services);
}

async function postHandler(request, response) {
  const created = await service.create(request.body);
  return response.status(201).json(created);
}
