import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import organization from "@/models/organization";
import qrCode from "@/models/qrCode";

export async function GET(request, context) {
  try {
    await controller.injectApiUser(request);
    const { slug } = await context.params;
    const studio = await organization.findBySlug(slug);
    const settings = await qrCode.findByOrganizationId(studio.id).catch(() => null);
    return Response.json(settings, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function PUT(request, context) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    const { slug } = await context.params;
    const studio = await organization.findBySlug(slug);

    const isAdmin = await organization.isAdmin(studio.id, requestUser.id);
    const isOwner = studio.owner_id === requestUser.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenError({
        message: "Apenas administradores do estúdio podem alterar o QR code.",
      });
    }

    const formData = await request.formData();
    const fgColor = formData.get("fg_color") || "#000000";
    const bgColor = formData.get("bg_color") || "#ffffff";
    const logoSize = Number.parseInt(formData.get("logo_size") || "24", 10);
    const logoFile = formData.get("logo_file") || null;

    await qrCode.upsertForOrganization(studio.id, { fgColor, bgColor, logoSize, logoFile });

    const result = await qrCode.findByOrganizationId(studio.id);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
