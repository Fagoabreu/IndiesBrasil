import controller from "@/infra/controller.js";
import { NotFoundError, ValidationError } from "@/infra/errors";
import authorization from "@/models/authorization";
import post from "@/models/post.js";
import uploadedImages from "@/models/uploadedImages";
import embededResolver from "@/infra/embededResolver";
import tags from "@/models/tags";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .patch(controller.canRequest("update:post"), patchHandler)
  .delete(controller.canRequest("read:session"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { post_id } = request.query;
  const userTryingToGet = request.context.user;

  const postData = await post.getPostById(userTryingToGet?.id || null, post_id);
  if (!postData) {
    throw new NotFoundError();
  }

  const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:post", postData);
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const { post_id } = request.query;
  const userTryingToUpdate = request.context.user;

  const content = typeof request.body?.content === "string" ? request.body.content.trim() : "";

  if (!content) {
    throw new ValidationError({
      message: "O conteúdo do post não pode ficar vazio.",
      action: "Escreva o texto do post antes de salvar a edição.",
    });
  }

  // `getPostById` aplica o filtro de moderação: post bloqueado responde 404
  // até para o autor — reescrever o texto não é caminho para sair da moderação.
  const postData = await post.getPostById(userTryingToUpdate.id, post_id);

  // Editar recalcula tags e embeds a partir do texto novo. Sem isso, a tag
  // removida continuaria no `post_tags` (e o filtro por tag acharia o post) e o
  // player do link apagado continuaria renderizado.
  const embeds = await embededResolver.getEmbededLinks(content);
  const tagList = await tags.getTagsFromText(content);

  const updatedPost = await post.update({
    postId: postData.id,
    authorId: userTryingToUpdate.id,
    content,
    tagList: Array.isArray(tagList) ? tagList : [],
    embed: embeds.length > 0 ? embeds : null,
  });

  const secureOutputValues = authorization.filterOutput(userTryingToUpdate, "read:post", updatedPost);

  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const post_id = request.query.post_id;
  const userTryingToDelete = request.context.user;
  const author_id = userTryingToDelete.id;

  const postToDelete = await post.getPostById(author_id, post_id);
  if (!postToDelete) {
    throw new NotFoundError();
  }

  const imgId = postToDelete.img;
  if (imgId) {
    uploadedImages.deleteImage(imgId);
  }

  await post.deleteCommentsByPostId(postToDelete.id);
  const resultPost = await post.deletePostByIdAndAuthorId(author_id, postToDelete.id);

  if (imgId) {
    await uploadedImages.deleteImage(imgId);
  }

  const secureOutputValues = authorization.filterOutput(userTryingToDelete, "read:post", resultPost);

  return response.status(200).json(secureOutputValues);
}
