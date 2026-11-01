import { createRouter } from "next-connect";
import controller from "infra/controller";
import aiUsage from "models/ai-usage";
import { UnauthorizedError } from "infra/errors";

export default createRouter().use(controller.injectAnonymousOrUser).post(postHandler).handler(controller.errorHandlers);

/**
 * POST /api/v1/ai-usage
 *
 * Body: `{ type, slug, level, notes? }`
 *   type  — "game" | "boardgame" | "book" | "asset"
 *   level — 0..5 (0 = "sem uso de IA"; `null` não se declara por aqui)
 *
 * A autorização **não** é "estar logado": quem classifica é quem pode editar o
 * produto. A checagem fica no model (`canEdit` de cada tipo), porque é a mesma
 * regra que a edição usa — e uma segunda cópia na rota divergiria.
 */
async function postHandler(request, response) {
  const requestUser = request.context.user;

  if (!requestUser?.id) {
    throw new UnauthorizedError({
      message: "Você precisa estar logado para declarar o uso de IA.",
      action: "Entre na sua conta para continuar.",
    });
  }

  const { type, slug, level, notes } = request.body;

  const saved = await aiUsage.saveUsage(type, slug, level, notes, requestUser);

  return response.status(200).json(saved);
}
