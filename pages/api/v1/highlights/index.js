import { createRouter } from "next-connect";
import controller from "infra/controller";
import highlight from "models/highlight";

export default createRouter().get(getHandler).handler(controller.errorHandlers);

async function getHandler(request, response) {
  // A regra (quais tipos, com imagem, sem moderação) mora em
  // `models/highlight.js`: a home renderiza os mesmos destaques no servidor,
  // e duas cópias da query divergiriam.
  const highlights = await highlight.findHighlights();

  return response.status(200).json(highlights);
}
