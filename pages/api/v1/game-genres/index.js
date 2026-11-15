import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import gameGenre from "models/gameGenre";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:game_genre:all"), getHandler)
  .post(controller.canRequest("read:admin"), postHandler)
  .handler(controller.errorHandlers);

/**
 * GET /api/v1/game-genres?include_inactive=true&flat=true
 *
 * Público: o filtro da listagem de jogos precisa do catálogo **sem sessão** —
 * `getServerSideProps` monta o HTML da primeira página, e o Google precisa ver
 * as opções no HTML servido.
 *
 * A resposta é a **árvore** por padrão (`[{ name, children: [...] }]`), porque é
 * o que o seletor (`<optgroup>`) e a tela de admin consomem. `?flat=true` existe
 * para quem só precisa iterar todos os nomes.
 *
 * Gêneros **inativos** só aparecem para administradores: são justamente os que
 * saíram do ar.
 */
async function getHandler(request, response) {
  const requestUser = request.context.user;
  const includeInactive = request.query.include_inactive === "true";
  const flat = request.query.flat === "true";

  if (includeInactive && !authorization.can(requestUser, "read:admin")) {
    throw new ForbiddenError({
      message: "Acesso restrito a administradores.",
      action: "Os gêneros desativados só podem ser vistos por administradores.",
    });
  }

  const catalog = flat ? await gameGenre.findAllNodes({ includeInactive }) : await gameGenre.findTree({ includeInactive });

  return response.status(200).json(catalog);
}

async function postHandler(request, response) {
  const created = await gameGenre.create(request.body);
  return response.status(201).json(created);
}
