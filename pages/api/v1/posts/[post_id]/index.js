import controller from "@/infra/controller.js";
import { NotFoundError } from "@/infra/errors";
import post from "@/models/post.js";
import uploadedImages from "@/models/uploadedImages";
import { createRouter } from "next-connect";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.delete(controller.canRequest("read:session"), deleteHandler);

export default router.handler(controller.errorHandlers);

async function deleteHandler(request, response) {
  const post_id = request.query.post_id;
  const author_id = request.context.user.id;

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

  return response.status(200).json(resultPost);
}
