import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course:rating"), listHandler)
  .post(controller.canRequest("create:course:rating"), upsertHandler)
  .handler(controller.errorHandlers);

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

  const { rating, review } = request.body;
  const result = await course.upsertRating(
    slug,
    requestUser.id,
    rating,
    review || null,
  );
  return response.status(200).json(result);
}
