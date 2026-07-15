import { createRouter } from "next-connect";
import controller from "infra/controller";
import stream from "models/stream";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("read:studio"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const result = await stream.refreshAllStreamStatuses();
  return response.status(200).json({ ok: true, checked: result.checked });
}
