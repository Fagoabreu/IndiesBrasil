import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course:enrollment"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { search = "" } = request.query;
  const userId = request.context.user.id;

  const enrolled = await course.getEnrolledCourses(userId);

  if (search) {
    const q = search.toLowerCase();
    const filtered = enrolled.filter((c) => c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    return response.status(200).json(filtered);
  }

  return response.status(200).json(enrolled);
}
