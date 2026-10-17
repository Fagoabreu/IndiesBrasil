import { createRouter } from "next-connect";
import controller from "infra/controller";
import stream from "models/stream";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:studio"), getHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/streams
 * Returns all studios with streaming channels and their latest live status.
 * Results are ordered: live channels first (by viewer count), then offline.
 *
 * A tradução linha → objeto do card mudou para o model (`serializeRow`, em
 * `models/stream.js`): a página de assistir lê o mesmo formato por `findBySlug`,
 * e manter a leitura aqui era garantir duas versões dela.
 */
async function getHandler(request, response) {
  const studios = await stream.getStudiosWithStreams();

  return response.status(200).json(studios);
}
