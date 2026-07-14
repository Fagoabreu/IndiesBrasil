import post from "@/models/post";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import uploadedImages from "@/models/uploadedImages";
import embededResolver from "@/infra/embededResolver";
import tags from "@/models/tags";
import { ForbiddenError } from "@/infra/errors";

/**
 * GET /api/v1/studios/[slug]/posts
 * Lista todos os posts vinculados ao estúdio.
 */
export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:post")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para visualizar posts.",
      });
    }

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);
    const posts = await post.getPostsByOrgId(user?.id ?? null, studio.id);
    const secureOutput = await authorization.filterOutput(
      user,
      "read:post:all",
      posts,
    );

    return Response.json(secureOutput, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/studios/[slug]/posts
 * Cria um post vinculado ao estúdio. Apenas membros, admins e donos.
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    if (!authorization.can(requestUser, "create:post")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para criar posts.",
      });
    }

    const { slug } = await params;
    const studio = await organization.findBySlug(slug);

    const isMember = await organization.isMember(studio.id, requestUser.id);
    const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
    const isOwner = studio.owner_id === requestUser.id;

    if (!isMember && !isAdmin && !isOwner) {
      throw new ForbiddenError({
        message: "Apenas membros do estúdio podem criar postagens.",
      });
    }

    const formData = await request.formData();
    const content = formData.get("content");
    const file = formData.get("file");

    const inputValues = {
      author_id: requestUser.id,
      organization_id: studio.id,
      content,
    };

    if (file) {
      const imageData = await uploadedImages.uploadImage(file, "posts");
      inputValues.img = imageData.id;
    }

    if (content) {
      const embeds = await embededResolver.getEmbededLinks(content);
      if (embeds.length > 0) inputValues.embed = embeds;

      const tagList = await tags.getTagsFromText(content);
      if (Array.isArray(tagList) && tagList.length > 0) {
        inputValues.tags = tagList;
      }
    }

    const created = await post.create(inputValues);
    const result = await post.getPostById(requestUser.id, created.id);
    const secureOutput = await authorization.filterOutput(
      requestUser,
      "read:post",
      result,
    );

    return Response.json(secureOutput, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
