import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import boardgame from "models/boardgame";
import { ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:boardgame"), getHandler)
  .post(controller.canRequest("create:boardgame:comment"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { slug } = request.query;
  const user = request.context.user;

  const bgData = await boardgame.findBySlug(slug);
  const comments = await boardgame.getComments(bgData.id, user.id);
  const secureOutputValues = authorization.filterOutput(user, "read:comment:all", comments);
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const user = request.context.user;
  const { slug } = request.query;

  const content = typeof request.body.content === "string" ? request.body.content.trim() : "";
  if (!content) {
    throw new ValidationError({
      message: "O comentário não pode estar vazio.",
      action: "Escreva um comentário antes de publicar.",
    });
  }

  const bgData = await boardgame.findBySlug(slug);
  const createdComment = await boardgame.createComment(bgData.id, user.id, content);

  const resultComment = {
    ...createdComment,
    author_username: user.username,
    is_current_user: true,
  };
  const secureOutputValues = authorization.filterOutput(user, "read:comment", resultComment);
  return response.status(201).json(secureOutputValues);
}
