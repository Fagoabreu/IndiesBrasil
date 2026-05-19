import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * POST /api/v1/events/[id]/banner
 * - multipart/form-data com campo "file": faz upload para cloudinary em events/[id]
 * - application/json com campo "external_url": define URL externa como banner
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:event")) {
      throw new ForbiddenError({ message: "Você não possui permissão para editar eventos." });
    }

    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";

    let updated;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      updated = await event.setBannerImage(id, file, user.id);
    } else {
      const { external_url } = await request.json();
      updated = await event.setBannerExternalUrl(id, external_url, user.id);
    }

    return Response.json({ banner_url: updated.banner_url }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * DELETE /api/v1/events/[id]/banner
 * Remove a imagem de capa (exclui do cloudinary se for upload).
 */
export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:event")) {
      throw new ForbiddenError({ message: "Você não possui permissão para editar eventos." });
    }

    const { id } = await params;
    await event.removeBanner(id, user.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
