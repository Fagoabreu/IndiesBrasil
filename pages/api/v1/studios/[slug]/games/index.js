import { createRouter } from "next-connect";
import controller from "infra/controller";
import game from "models/game";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:game"), getHandler)
  .post(controller.canRequest("create:game"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  const games = await game.findByOrg(studio.id);
  return response.status(200).json(games);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const studio = await organization.findBySlug(slug);

  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  const isOwner = studio.owner_id === requestUser.id;

  if (!isAdmin && !isOwner) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem criar jogos.",
    });
  }

  const newGame = await game.create(studio.id, requestUser.id, request.body);
  return response.status(201).json(newGame);
}
