import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import user from "models/user.js";
import activation from "models/activation.js";
import authorization from "@/models/authorization";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:user"), postHandler)
  .get(controller.canRequest("read:user"), getHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = request.body;
  const newUser = await user.create(userInputValues);

  const activationToken = await activation.create(newUser.id);
  await activation.sendEmailToUser(newUser, activationToken);

  const secureOutputValues = authorization.filterOutput(userTryingToPost, "read:user", newUser);
  return response.status(201).json(secureOutputValues);
}

// TODO proteger request
async function getHandler(request, response) {
  const userTryingToPost = request.context.user;
  const isfollowing = request.query.isfollowing;
  const userId = request.context.user.id;
  const selectedUsers = await user.findUsers(userId, isfollowing);
  const secureOutputValues = selectedUsers.map((selectedUser) => {
    return authorization.filterOutput(userTryingToPost, "read:user", selectedUser);
  });
  return response.status(200).json(secureOutputValues);
}
