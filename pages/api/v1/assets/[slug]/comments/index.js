import { createRouter } from "next-connect";
import controller from "infra/controller";
import authorization from "models/authorization";
import asset from "models/asset";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:asset"), getHandler)
  .post(controller.canRequest("create:asset:comment"), postHandler)
  .handler(controller.errorHandlers);

/** Leitura pública — o visitante sem sessão vê os comentários. */
async function getHandler(request, response) {
  const { slug } = request.query;
  const user = request.context.user;

  const assetData = await asset.findBySlug(slug);
  const comments = await asset.getComments(assetData.id, user.id);

  const secureOutputValues = authorization.filterOutput(user, "read:comment:all", comments);
  return response.status(200).json(secureOutputValues);
}

/** Comentar exige sessão (`create:asset:comment`). */
async function postHandler(request, response) {
  const user = request.context.user;
  const { slug } = request.query;

  const assetData = await asset.findBySlug(slug);
  const createdComment = await asset.createComment(assetData.id, user.id, request.body?.content);

  const resultComment = {
    ...createdComment,
    author_username: user.username,
    is_current_user: true,
  };

  const secureOutputValues = authorization.filterOutput(user, "read:comment", resultComment);
  return response.status(201).json(secureOutputValues);
}
