import { createRouter } from "next-connect";
import controller from "infra/controller";
import { ForbiddenError } from "@/infra/errors";
import profile from "@/models/profile";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(controller.canRequest("read:user"), getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const username = request.query.username;
  const newFound = await profile.findByUsername(username);
  return response.status(200).json(newFound);
}
