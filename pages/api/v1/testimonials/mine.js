import { createRouter } from "next-connect";
import controller from "infra/controller";
import rateLimit from "lib/rate-limit.js";
import testimonial from "models/testimonial";

/**
 * O depoimento do próprio usuário — um único recurso, sem id na URL.
 *
 * Como a regra é **um por pessoa**, a rota fica em `/mine`: o cliente não
 * precisa descobrir nem guardar o id, e não existe caminho de escrita que
 * receba o id de outra pessoa. A posse é verificada no model, que filtra por
 * `author_id` em toda query de escrita.
 *
 * Edição e remoção usam `create:testimonial`, a mesma feature do envio: o
 * depoimento é um só, e quem pode criar é quem pode manter o seu. Criar uma
 * feature nova aqui exigiria registrá-la nos três lugares de sempre e nos
 * arrays de teste sem mudar nenhuma autorização de fato.
 */
export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:testimonial"), getHandler)
  .patch(controller.rateLimitBy({ limiter: rateLimit.limiters.write }), controller.canRequest("create:testimonial"), patchHandler)
  .delete(controller.canRequest("create:testimonial"), deleteHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/testimonials/mine
 *
 * Devolve o depoimento do usuário logado (em qualquer status) ou `null`.
 * O `null` é o estado "ainda não escrevi" que o formulário usa para decidir
 * entre criar e editar — não é recurso ausente.
 */
async function getHandler(request, response) {
  const requestUser = request.context.user;

  if (!requestUser?.id) {
    return response.status(200).json(null);
  }

  const mine = await testimonial.findByAuthor(requestUser.id);
  return response.status(200).json(mine);
}

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const { content, role } = request.body || {};

  const updated = await testimonial.updateByAuthor(requestUser.id, { content, role });
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;

  await testimonial.removeByAuthor(requestUser.id);
  return response.status(204).end();
}
