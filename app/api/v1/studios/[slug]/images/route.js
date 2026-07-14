import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import organization from "@/models/organization";

/**
 * POST /api/v1/studios/[slug]/images
 *
 * Body: FormData com
 *   file    — arquivo de imagem
 *   imgType — "logo" | "banner"
 *
 * Apenas admins e o dono do estúdio podem fazer upload.
 */
export async function POST(request, context) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    const { slug } = await context.params;
    const studio = await organization.findBySlug(slug);

    const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
    const isOwner = studio.owner_id === requestUser.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenError({
        message: "Apenas administradores do estúdio podem alterar as imagens.",
      });
    }

    const formData = await request.formData();
    const imgType = formData.get("imgType") || "logo"; // "logo" | "banner"
    const file = formData.get("file");

    if (!file) {
      return Response.json(
        { message: "Nenhum arquivo enviado." },
        { status: 400 },
      );
    }

    const folder = `studios/${studio.id}/${imgType}`;
    const imageData = await uploadedImages.uploadImage(file, folder);

    if (imgType === "logo") {
      await organization.saveLogo(slug, imageData.id);
    } else if (imgType === "banner") {
      await organization.saveBanner(slug, imageData.id);
    } else {
      return Response.json(
        { message: "imgType inválido. Use 'logo' ou 'banner'." },
        { status: 400 },
      );
    }

    return Response.json(
      { id: imageData.id, url: imageData.secure_url },
      { status: 201 },
    );
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
