import controller from "@/infra/controller";
import user from "@/models/user";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("read:session"), postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const logedUser = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsername(username);
  const toggleFollow = await user.toggleFollow(logedUser.id, userFound.id);
  return response.status(200).json(toggleFollow);
}
