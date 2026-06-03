import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:studio"), listHandler);
router.post(controller.canRequest("create:studio"), createHandler);

export default router.handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { page = 1, limit = 20, search = "", isfollowing, member } = request.query;
  const requestUser = request.context.user;

  let studios;
  if (member === "me" && requestUser?.id) {
    studios = await organization.findByMember(requestUser.id);
  } else if (isfollowing === "true" && requestUser?.id) {
    studios = await organization.findFollowing(requestUser.id, {
      page: Number(page),
      limit: Number(limit),
      search,
    });
  } else {
    studios = await organization.findAll({ page: Number(page), limit: Number(limit), search });
  }

  return response.status(200).json(studios);
}

async function createHandler(request, response) {
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:studio")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para criar um estúdio.",
    });
  }

  const studio = await organization.create(requestUser, request.body);
  return response.status(201).json(studio);
}
