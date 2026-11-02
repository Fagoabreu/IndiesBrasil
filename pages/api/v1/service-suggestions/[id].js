import { createRouter } from "next-connect";
import controller from "infra/controller";
import serviceSuggestion from "models/serviceSuggestion";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .handler(controller.errorHandlers);

/**
 * PATCH /api/v1/service-suggestions/[id]
 *
 * Body:
 *   `{ status: "approved", group_key, description?, display_order? }` — cria o
 *   serviço no catálogo e grava `service_id` na sugestão;
 *   `{ status: "rejected" }` — só marca.
 *
 * Aprovar **cria** o serviço aqui, e não no cliente: o admin não deveria
 * precisar ir a outro formulário depois e redigitar o nome que acabou de ler.
 */
async function patchHandler(request, response) {
  const { id } = request.query;
  const requestUser = request.context.user;

  const updated = await serviceSuggestion.review(id, request.body, requestUser.id);
  return response.status(200).json(updated);
}
