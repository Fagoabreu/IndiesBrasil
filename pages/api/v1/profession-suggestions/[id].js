import { createRouter } from "next-connect";
import controller from "infra/controller";
import professionSuggestion from "models/professionSuggestion";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .handler(controller.errorHandlers);

/**
 * PATCH /api/v1/profession-suggestions/[id]
 *
 * Body:
 *   `{ status: "approved", group_key, icon_img, description?, display_order? }`
 *     — cria a profissão no catálogo e marca a sugestão;
 *   `{ status: "rejected" }` — só marca.
 *
 * Aprovar **cria** a profissão aqui, e não no cliente: o admin já leu o nome e
 * escolheu o ícone, e mandá-lo a outro formulário depois seria o passo que faz a
 * fila nunca esvaziar. `icon_img` é obrigatório justamente porque não há como
 * inferi-lo (ver `lib/professionIcons.js`).
 */
async function patchHandler(request, response) {
  const { id } = request.query;
  const requestUser = request.context.user;

  const updated = await professionSuggestion.review(id, request.body, requestUser.id);
  return response.status(200).json(updated);
}
