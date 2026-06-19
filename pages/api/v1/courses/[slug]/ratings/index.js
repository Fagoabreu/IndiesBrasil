import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:course:rating"), listHandler);
router.post(controller.canRequest("create:course:rating"), upsertHandler);

export default router.handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { slug } = request.query;

  const ratings = await course.getCourseRatings(slug);
  return response.status(200).json(ratings);
}

async function upsertHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:course:rating")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para avaliar cursos.",
    });
  }

  const { rating } = request.body;
  const result = await course.upsertRating(slug, requestUser.id, rating);
  return response.status(200).json(result);
}
