import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import user from "models/user.js";
import activation from "models/activation.js";
import authorization from "@/models/authorization";
import { ForbiddenError, ValidationError } from "infra/errors";
import rateLimit from "lib/rate-limit.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.rateLimitBy({ limiter: rateLimit.limiters.register }), controller.canRequest("create:user"), postHandler)
  .get(controller.canRequest("read:user"), getHandler)
  .handler(controller.errorHandlers);

/** Valores aceitos em `?status=`. */
const MEMBER_STATUSES = ["active", "inactive"];

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = request.body;
  const newUser = await user.create(userInputValues);

  const activationToken = await activation.create(newUser.id);
  await activation.sendEmailToUser(newUser, activationToken);

  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:user", newUser);
  return response.status(201).json(secureOutputValues);
}

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const { isfollowing, cursor, q, limit, status } = request.query;
  const userId = request.context.user.id;

  const rawStatus = Array.isArray(status) ? status[0] : status;
  if (rawStatus !== undefined && !MEMBER_STATUSES.includes(rawStatus)) {
    // Valor inválido não pode cair no default: quem digitou `?status=inativo`
    // receberia a lista normal achando que está vendo as contas travadas.
    throw new ValidationError({
      message: `Status inválido: ${JSON.stringify(rawStatus)}.`,
      action: `Use ${MEMBER_STATUSES.map((value) => `\`${value}\``).join(" ou ")}.`,
    });
  }

  const includeInactive = rawStatus === "inactive";

  // A lista de contas travadas expõe e-mail e vencimento de token — dados que
  // não pertencem à listagem pública. `read:user` (quem está logado) não basta.
  if (includeInactive && !authorization.can(userTryingToGet, "read:admin")) {
    throw new ForbiddenError({
      message: "Acesso restrito a administradores.",
      action: "Você não possui permissão para consultar contas não ativadas.",
    });
  }

  const { items, total, hasMore, nextCursor } = await user.findUsers({
    userId,
    isfollowing,
    cursor,
    q,
    limit,
    status: includeInactive ? "inactive" : "active",
  });

  // Contas travadas: resposta montada campo a campo. `filterOutput("read:user")`
  // deixaria de fora justamente `email` e `activation_expires_at`, que são o
  // motivo de a lista existir.
  const secureOutputValues = includeInactive
    ? items.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        created_at: row.created_at,
        activation_expires_at: row.activation_expires_at,
        // Um token de outra finalidade (reset) mantém o cadastro: a limpeza
        // automática de cadastro abandonado não o anula.
        has_other_token: row.has_other_token,
      }))
    : items.map((selectedUser) => authorization.filterOutput(userTryingToGet, "read:user", selectedUser));

  return response.status(200).json({
    items: secureOutputValues,
    total,
    has_more: hasMore,
    next_cursor: nextCursor,
  });
}
