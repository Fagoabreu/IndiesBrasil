import post from "@/models/post";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import embededResolver from "@/infra/embededResolver";
import tags from "@/models/tags";
import authorization from "@/models/authorization";

export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:post")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "create:post" para executar esta ação.',
      });
    }

    const formData = await request.formData();
    const content = formData.get("content");
    const file = formData.get("file");
    const event_id = formData.get("event_id") || undefined;

    const userInputValues = { content, author_id: user.id };
    if (event_id) userInputValues.event_id = event_id;

    if (file) {
      const imageData = await uploadedImages.uploadImage(file, "posts");
      userInputValues.img = imageData.id;
    }

    if (content) {
      const embeds = await embededResolver.getEmbededLinks(content);
      if (embeds.length > 0) userInputValues.embed = embeds;

      const tagList = await tags.getTagsFromText(content);
      if (Array.isArray(tagList) && tagList.length > 0) {
        userInputValues.tags = tagList;
      }
    }

    const createdPost = await post.create(userInputValues);
    const resultPost = await post.getPostById(user.id, createdPost.id);
    const secureOutputValues = await authorization.filterOutput(user, "read:post", resultPost);

    return Response.json(secureOutputValues, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:post")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "read:post" para executar esta ação.',
      });
    }

    const { searchParams } = request.nextUrl;
    const searchType = searchParams.get("search_type");
    const tag = searchParams.get("tag");

    const posts = await post.getPosts(user.id, searchType, tag);
    const secureOutputValues = await authorization.filterOutput(user, "read:post:all", posts);
    return Response.json(secureOutputValues, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
