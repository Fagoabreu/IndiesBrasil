import { createRouter } from "next-connect";
import controller from "infra/controller";
import userAddress from "models/userAddress";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:address"), patchHandler)
  .delete(controller.canRequest("delete:address"), deleteHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const requestUser = request.context.user;
  const updated = await userAddress.updateForUser(request.query.id, requestUser.id, request.body);
  return response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  const requestUser = request.context.user;
  await userAddress.removeForUser(request.query.id, requestUser.id);
  return response.status(200).json({ message: "Endereço removido." });
}
