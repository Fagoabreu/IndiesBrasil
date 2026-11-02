import { createRouter } from "next-connect";
import controller from "infra/controller";
import professionSuggestion from "models/professionSuggestion";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:admin"), getHandler)
  .post(controller.canRequest("create:profession_suggestion"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/profession-suggestions?status=pending
 *
 * Fila de decisão do administrador. `status` desconhecido responde 400 — cair no
 * `pending` faria `?status=aprovado` parecer que existe fila nenhuma.
 */
async function getHandler(request, response) {
  const status = typeof request.query.status === "string" ? request.query.status.trim() : "pending";
  const suggestions = await professionSuggestion.findAll({ status });
  return response.status(200).json(suggestions);
}

/**
 * POST /api/v1/profession-suggestions
 *
 * Body: `{ name, justification? }` — qualquer usuário autenticado sugere.
 *
 * Visitante recebe **403**, não 401: quem barra é `canRequest`, antes do
 * handler, e é a convenção do projeto para ação que exige feature.
 *
 * Nome que já existe no catálogo responde 400 apontando qual — senão o admin
 * aprovaria uma duplicata e o catálogo teria dois itens iguais em grupos
 * diferentes.
 */
async function postHandler(request, response) {
  const created = await professionSuggestion.create(request.body, request.context.user.id);
  return response.status(201).json(created);
}
