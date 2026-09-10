import { createRouter } from "next-connect";
import controller from "infra/controller";
import embededResolver from "infra/embededResolver";

export default createRouter().use(controller.injectAnonymousOrUser).get(getHandler).handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { url } = request.query;

  if (!url) {
    return response.status(400).json({ error: "Parâmetro 'url' é obrigatório." });
  }

  try {
    // O id numérico do widget da itch.io não está na URL da loja; a resolução
    // (com cache) vive no embededResolver.
    const widget = await embededResolver.resolveItchWidget(url);
    return response.status(200).json(widget);
  } catch {
    return response.status(200).json(null);
  }
}
