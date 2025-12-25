import controller from "@/infra/controller.js";
import post from "@/models/post.js";
import { createRouter } from "next-connect";

export const config = {
  api: {
    bodyParser: false,
  },
};

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:post"), postHandler);
router.get(controller.canRequest("read:post"), getHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const authorId = request.context.user.id;
  const formData = await request.formData();
  const content = formData.get("content");
  const visibility = formData.get("visibility");
  const parentPostId = formData.get("parent_post_id");
  const file = formData.get("file");

  const userInputValues = {
    author_id: authorId,
    content: content,
    visibility: visibility,
    parent_post_id: parentPostId,
  };

  if (file) {
    const uploadedImage = await post.uploadImage(file, authorId);
    userInputValues.img = uploadedImage;
  }

  const createdPost = await post.create(userInputValues);
  const resultPost = await post.getPostById(userInputValues.author_id, createdPost.id);
  response.setHeader("Cache-Control", "no-store,no-cache-max-age=0,must-revalidate");
  return response.status(201).json(resultPost);
}

async function getHandler(request, response) {
  const userId = request.context.user.id;
  const posts = await post.getPosts(userId);
  response.setHeader("Cache-Control", "no-store,no-cache-max-age=0,must-revalidate");
  return response.status(200).json(posts);
}
