import { createRouter } from "next-connect";
import controller from "infra/controller";
import userAddress from "models/userAddress";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:address"), listHandler)
  .post(controller.canRequest("create:address"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const requestUser = request.context.user;
  const addresses = await userAddress.findByUserId(requestUser.id);
  return response.status(200).json(addresses);
}

async function createHandler(request, response) {
  const requestUser = request.context.user;
  const { label, is_default: isDefault, ...addressData } = request.body;

  const created = await userAddress.createForUser(requestUser.id, addressData, {
    label,
    isDefault,
  });

  return response.status(201).json(created);
}
