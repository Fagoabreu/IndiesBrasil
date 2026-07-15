import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import course from "models/course";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course"), listHandler)
  .post(controller.canRequest("create:course"), createHandler)
  .handler(controller.errorHandlers);

async function listHandler(request, response) {
  const { page = 1, limit = 20, search = "", tag = "" } = request.query;

  const courses = await course.findAll({
    page: Number(page),
    limit: Number(limit),
    search,
    tag,
  });

  return response.status(200).json(courses);
}

async function createHandler(request, response) {
  const requestUser = request.context.user;

  if (!authorization.can(requestUser, "create:course")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para criar cursos.",
    });
  }

  const newCourse = await course.create(requestUser.id, request.body);
  return response.status(201).json(newCourse);
}
