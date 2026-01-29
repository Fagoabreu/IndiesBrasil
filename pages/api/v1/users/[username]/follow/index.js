import controller from "@/infra/controller";
import { ValidationError } from "@/infra/errors";
import user from "@/models/user";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("read:session"), postHandler);
router.delete(controller.canRequest("read:session"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const logedUser = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsernameSecured(username);
  if (logedUser.id === userFound.id) {
    throw new ValidationError({ message: "O usuário não pode seguir a si mesmo" });
  }
  const toggleFollow = await user.addFollow(logedUser.id, userFound.id);
  return response.status(200).json(toggleFollow);
}

async function deleteHandler(request, response) {
  const logedUser = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsernameSecured(username);
  const toggleFollow = await user.removeFollow(logedUser.id, userFound.id);
  return response.status(200).json(toggleFollow);
}
