import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:course"), getHandler)
  .post(controller.canRequest("update:course"), postHandler)
  .patch(controller.canRequest("update:course"), patchHandler)
  .delete(controller.canRequest("update:course"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;

  const modules = await course.findModulesByCourseSlug(slug);
  const lessons = await course.findLessonsByCourseSlug(slug);

  return response.status(200).json({
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      order_index: m.order_index,
      lesson_count: Number(m.lesson_count),
      lessons: lessons
        .filter((l) => l.module_id === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          order_index: l.order_index,
          video_url: l.video_url,
          reading_material: l.reading_material,
          description: l.description,
        })),
    })),
    unassignedLessons: lessons
      .filter((l) => !l.module_id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        order_index: l.order_index,
        video_url: l.video_url,
        reading_material: l.reading_material,
        description: l.description,
      })),
  });
}

async function postHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  const { title, orderIndex } = request.body;

  const createdModule = await course.createModule(slug, requestUser.id, {
    title,
    orderIndex,
  });

  return response.status(201).json(createdModule);
}

async function patchHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  const { moduleId, title, orderIndex } = request.body;

  const updatedModule = await course.updateModule(
    slug,
    moduleId,
    requestUser.id,
    { title, orderIndex },
  );

  return response.status(200).json(updatedModule);
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  const { moduleId } = request.body;

  await course.deleteModule(slug, moduleId, requestUser.id);

  return response.status(204).end();
}
