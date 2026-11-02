import controller from "@/infra/controller.js";
import authorization from "@/models/authorization";
import profession from "@/models/profession";
import { createRouter } from "next-connect";
import { ForbiddenError, ValidationError } from "infra/errors";
import { PROFESSION_GROUP_KEYS, isValidProfessionGroup } from "lib/professionGroups";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:session"), getHandler)
  .post(controller.canRequest("read:admin"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/professions?include_inactive=true&group=arte
 *
 * O catálogo é lido por qualquer usuário com sessão (o seletor de
 * especialização do perfil precisa dele). As profissões **inativas** só
 * aparecem para administradores: são justamente as que saíram do ar.
 *
 * `group` desconhecido responde 400 em vez de devolver tudo — cair no padrão
 * faria `?group=art` parecer aplicado.
 */
async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const includeInactive = request.query.include_inactive === "true";
  const group = typeof request.query.group === "string" ? request.query.group.trim() : "";

  if (includeInactive && !authorization.can(userTryingToGet, "read:admin")) {
    throw new ForbiddenError({
      message: "Acesso restrito a administradores.",
      action: "As profissões desativadas só podem ser vistas por administradores.",
    });
  }

  if (group && !isValidProfessionGroup(group)) {
    throw new ValidationError({
      message: "Grupo de profissão inválido.",
      action: `Informe um dos grupos: ${PROFESSION_GROUP_KEYS.join(", ")}.`,
    });
  }

  const professions = await profession.findAll({ includeInactive, group });
  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:profession:all", professions);

  return response.status(200).json(secureOutputValues);
}

/**
 * POST /api/v1/professions
 *
 * Antes da migration `1793750400000` este endpoint respondia **500** sempre: a
 * coluna era um enum cujos valores já estavam todos na tabela, então o INSERT
 * colidia com a primary key. Agora é catálogo de verdade.
 */
async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const inserted = await profession.create(request.body);
  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:profession", inserted);

  return response.status(201).json(secureOutputValues);
}
