import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .post(controller.canRequest("create:course:enrollment"), postHandler)
  .delete(controller.canRequest("create:course:enrollment"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;

  if (!request.context.user) {
    return response.status(200).json({
      enrolled: false,
    });
  }

  try {
    const enrolled = await course.isUserEnrolled(slug, request.context.user.id);
    return response.status(200).json({ enrolled });
  } catch (error) {
    if (error.name === "NotFoundError") {
      return response.status(404).json({
        name: error.name,
        message: error.message,
        status_code: 404,
      });
    }

    throw error;
  }
}

async function postHandler(request, response) {
  const { slug } = request.query;
  const { userId } = request.body;

  if (!userId) {
    return response.status(400).json({
      name: "ValidationError",
      message: "User ID é obrigatório.",
      status_code: 400,
    });
  }

  // Check if user trying to enroll themselves
  if (request.context.user?.id !== userId) {
    return response.status(403).json({
      name: "ForbiddenError",
      message: "Você não pode inscrever outro usuário.",
      status_code: 403,
    });
  }

  try {
    const enrolled = await course.enrollUser(slug, userId);

    return response.status(201).json({
      enrolled,
      message: enrolled
        ? "Inscrito no curso com sucesso."
        : "Já estava inscrito neste curso.",
    });
  } catch (error) {
    if (error.name === "NotFoundError") {
      return response.status(404).json({
        name: error.name,
        message: error.message,
        status_code: 404,
      });
    }

    throw error;
  }
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const { userId } = request.body;

  if (!userId) {
    return response.status(400).json({
      name: "ValidationError",
      message: "User ID é obrigatório.",
      status_code: 400,
    });
  }

  // Check if user trying to unenroll themselves
  if (request.context.user?.id !== userId) {
    return response.status(403).json({
      name: "ForbiddenError",
      message: "Você não pode desinscrever outro usuário.",
      status_code: 403,
    });
  }

  try {
    const unenrolled = await course.unenrollUser(slug, userId);

    return response.status(200).json({
      unenrolled,
      message: unenrolled
        ? "Desinscrito do curso com sucesso."
        : "Você não estava inscrito neste curso.",
    });
  } catch (error) {
    if (error.name === "NotFoundError") {
      return response.status(404).json({
        name: error.name,
        message: error.message,
        status_code: 404,
      });
    }

    throw error;
  }
}
