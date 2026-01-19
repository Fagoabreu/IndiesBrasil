import { createRouter } from "next-connect";
import controller from "infra/controller";
import { ForbiddenError } from "@/infra/errors";
import profile from "@/models/profile";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);
router.patch(controller.canRequest("update:user"), patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const username = request.query.username;
  const newFound = await profile.findByUsername(username);
  return response.status(200).json(newFound);
}

async function patchHandler(request, response) {
  const currentUser = request.context.user;
  const username = request.query.username;
  const userInputValues = request.body;

  if (currentUser.username !== username) {
    throw new ForbiddenError({ message: "Alteração não autorizada", action: "Verifique sua permissões" });
  }

  const updatedUser = await profile.update(username, userInputValues);
  return response.status(200).json(updatedUser);
}
