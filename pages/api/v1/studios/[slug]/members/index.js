import { createRouter } from "next-connect";
import controller from "infra/controller";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:studio:member"), listHandler);

export default router.handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  const members = await organization.findMembers(studio.id);
  return response.status(200).json(members);
}
