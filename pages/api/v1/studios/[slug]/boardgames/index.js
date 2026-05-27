import { createRouter } from "next-connect";
import controller from "infra/controller";
import boardgame from "models/boardgame";
import organization from "models/organization";
import { ForbiddenError } from "infra/errors";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:boardgame:all"), getHandler);
router.post(controller.canRequest("create:boardgame"), postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const studio = await organization.findBySlug(slug);
  const boardgames = await boardgame.findByOrg(studio.id);
  return response.status(200).json(boardgames);
}

async function postHandler(request, response) {
  const requestUser = request.context.user;
  const { slug } = request.query;

  const studio = await organization.findBySlug(slug);

  const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
  const isOwner = studio.owner_id === requestUser.id;

  if (!isAdmin && !isOwner) {
    throw new ForbiddenError({
      message: "Apenas administradores do estúdio podem criar jogos de mesa.",
    });
  }

  const newBoardgame = await boardgame.create(requestUser.id, studio.id, request.body);
  return response.status(201).json(newBoardgame);
}
