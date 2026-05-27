import { createRouter } from "next-connect";
import controller from "infra/controller";
import stream from "models/stream";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

/**
 * POST /api/v1/streams/refresh
 * Triggers a fresh check of all Twitch/YouTube channels and updates the cache.
 * No special auth required — rate limiting should be added at the infra level
 * if this becomes a public endpoint. For now it's available to any authenticated user.
 */
router.post(controller.canRequest("read:studio"), postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const result = await stream.refreshAllStreamStatuses();
  return response.status(200).json({ ok: true, checked: result.checked });
}
