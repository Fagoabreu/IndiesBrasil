import { createRouter } from "next-connect";
import controller from "infra/controller";
import store from "models/store";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:store:order"), getHandler)
  .patch(controller.canRequest("update:store:order"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { id } = request.query;
  const requestUser = request.context.user;

  const order = await store.findOrderById(id);

  const org = await organization.findById(order.organization_id);
  const isOwner = await organization.isOwner(org, requestUser.id);
  const isAdmin = await organization.isAdmin(org.id, requestUser.id);
  const isBuyer = order.buyer_id === requestUser.id;

  if (!isOwner && !isAdmin && !isBuyer) {
    throw new ForbiddenError({
      message: "Você não tem permissão para ver este pedido.",
    });
  }

  return response.status(200).json({
    ...order,
    viewer: { canManage: isOwner || isAdmin, isBuyer },
  });
}

async function patchHandler(request, response) {
  const { id } = request.query;
  const requestUser = request.context.user;

  const updated = await store.updateOrder(id, requestUser.id, request.body);
  return response.status(200).json(updated);
}
