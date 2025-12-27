import post from "@/models/post";
import controller from "@/infra/controller";
import { UnauthorizedError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import embededResolver from "@/infra/embededResolver";

export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!controller.canRequest("create:post")) {
      return new UnauthorizedError();
    }

    const formData = await request.formData();
    const content = formData.get("content");
    const file = formData.get("file");

    const userInputValues = {
      content,
      author_id: user.id,
    };

    if (file) {
      const imageData = await uploadedImages.uploadImage(file, "posts");
      userInputValues.img = imageData.id;
    }

    if (content) {
      const embeds = await embededResolver.getEmbededLinks(content);
      if (embeds.length > 0) userInputValues.embed = embeds;
    }

    const createdPost = await post.create(userInputValues);
    const resultPost = await post.getPostById(user.id, createdPost.id);

    return Response.json(resultPost, { status: 201 });
  } catch (error) {
    return controller.onErrorHandler(error, request);
  }
}

export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!controller.canRequest("read:post")) {
      return new UnauthorizedError();
    }

    const posts = await post.getPosts(user.id);

    return Response.json(posts, { status: 200 });
  } catch (error) {
    return controller.onErrorHandler(error, request);
  }
}
