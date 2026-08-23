import { createRouter } from "next-connect";
import controller from "infra/controller";
import store from "models/store";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:store:order"), listHandler)
  .post(controller.canRequest("create:store:order"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const requestUser = request.context.user;
  const { org = "" } = request.query;

  // Estúdio listando os pedidos recebidos na sua loja.
  if (org) {
    const studio = await organization.findBySlug(org);
    const isOwner = await organization.isOwner(studio, requestUser.id);
    const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError({
        message: "Apenas o dono ou administradores do estúdio podem ver os pedidos.",
      });
    }

    const orders = await store.findOrdersByOrg(studio.id);
    return response.status(200).json(orders);
  }

  // Comprador listando os próprios pedidos.
  const orders = await store.findOrdersByBuyer(requestUser.id);
  return response.status(200).json(orders);
}

async function createHandler(request, response) {
  const requestUser = request.context.user;
  const newOrder = await store.createOrder(requestUser.id, request.body);
  return response.status(201).json(newOrder);
}
