import controller from "@/infra/controller";
import { ValidationError } from "@/infra/errors";
import authorization from "@/models/authorization";
import user from "@/models/user";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("read:session"), postHandler)
  .delete(controller.canRequest("read:session"), deleteHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const logedUser = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsernameSecured(username);
  if (logedUser.id === userFound.id) {
    throw new ValidationError({
      message: "O usuário não pode seguir a si mesmo",
    });
  }
  const toggleFollow = await user.addFollow(logedUser.id, userFound.id);
  const secureOutputValues = authorization.filterOutput(
    logedUser,
    "read:user_follow",
    toggleFollow,
  );

  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const logedUser = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsernameSecured(username);
  if (logedUser.id === userFound.id) {
    throw new ValidationError({
      message: "O usuário não pode seguir a si mesmo",
    });
  }
  const toggleFollow = await user.removeFollow(logedUser.id, userFound.id);
  const secureOutputValues = authorization.filterOutput(
    logedUser,
    "read:user_follow",
    toggleFollow,
  );

  return response.status(200).json(secureOutputValues);
}
