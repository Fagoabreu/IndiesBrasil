import { createRouter } from "next-connect";
import controller from "infra/controller";
import profile from "@/models/profile";
import authorization from "@/models/authorization";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const readUser = request.context.user;
  const username = request.query.username;
  const newFound = await profile.findByUsername(username, readUser);
  const secureOutputValues = authorization.filterOutput(readUser, "read:profile", newFound);
  return response.status(200).json(secureOutputValues);
}
