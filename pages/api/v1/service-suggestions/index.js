import { createRouter } from "next-connect";
import controller from "infra/controller";
import serviceSuggestion from "models/serviceSuggestion";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:admin"), getHandler)
  .post(controller.canRequest("create:service_suggestion"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/service-suggestions?status=pending
 *
 * Fila de decisão do administrador. `status` desconhecido responde 400 — cair no
 * `pending` faria `?status=aprovado` parecer que existe fila nenhuma.
 */
async function getHandler(request, response) {
  const status = typeof request.query.status === "string" ? request.query.status.trim() : "pending";
  const suggestions = await serviceSuggestion.findAll({ status });
  return response.status(200).json(suggestions);
}

/**
 * POST /api/v1/service-suggestions
 *
 * Body: `{ name, justification? }` — qualquer usuário autenticado sugere.
 *
 * Visitante recebe **403**, não 401: quem barra é `canRequest`, antes do
 * handler, e é a convenção do projeto para ação que exige feature (curtir,
 * comentar e avaliar respondem igual). Um 401 aqui exigiria abrir a rota ao
 * anônimo só para recusá-lo depois.
 *
 * Nome que já existe no catálogo responde 400 apontando qual: aceitar criaria
 * uma sugestão que o admin aprovaria e descobriria depois ser duplicata — ou,
 * pior, um segundo serviço com o mesmo nome em outro grupo.
 */
async function postHandler(request, response) {
  const created = await serviceSuggestion.create(request.body, request.context.user.id);
  return response.status(201).json(created);
}
