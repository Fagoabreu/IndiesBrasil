import { createRouter } from "next-connect";
import controller from "infra/controller";
import service from "models/service";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("read:admin"), patchHandler)
  .delete(controller.canRequest("read:admin"), deleteHandler)
  .handler(controller.errorHandlers);

/**
 * PATCH /api/v1/services/[id]
 *
 * Edita o catálogo. `is_active: false` é o caminho normal para aposentar um
 * serviço — ele sai do seletor e dos filtros mas continua nos estúdios que já o
 * declararam.
 */
async function patchHandler(request, response) {
  const { id } = request.query;
  const updated = await service.update(Number.parseInt(id, 10), request.body);
  return response.status(200).json(updated);
}

/**
 * DELETE /api/v1/services/[id]
 *
 * Só quando nenhum estúdio usa. Em uso, o model responde 400 com a contagem —
 * cascata removeria a declaração de estúdios que não pediram nada.
 */
async function deleteHandler(request, response) {
  const { id } = request.query;
  await service.deleteService(Number.parseInt(id, 10));
  return response.status(204).end();
}
