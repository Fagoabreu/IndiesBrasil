import { createRouter } from "next-connect";
import controller from "infra/controller";
import embededResolver from "infra/embededResolver";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(getHandler);
export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { url } = request.query;

  if (!url) {
    return response.status(400).json({ error: "Parâmetro 'url' é obrigatório." });
  }

  try {
    const preview = await embededResolver.fetchLinkPreview(url);
    if (!preview) {
      return response.status(200).json(null);
    }
    return response.status(200).json(preview);
  } catch {
    return response.status(200).json(null);
  }
}
