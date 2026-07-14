import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import user from "@/models/user";
import qrCode from "@/models/qrCode";

export async function GET(request, context) {
  try {
    await controller.injectApiUser(request);
    const { username } = await context.params;
    const targetUser = await user.findOneByUsername(username);
    const settings = await qrCode.findByUserId(targetUser.id).catch(() => null);
    return Response.json(settings, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function PUT(request, context) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    const { username } = await context.params;
    const targetUser = await user.findOneByUsername(username);

    if (!authorization.can(requestUser, "update:user", targetUser)) {
      throw new ForbiddenError({
        message: "Você não possui permissão para executar esta ação",
        action:
          'Verifique se o seu usuário possui a feature "update:user" para executar esta ação.',
      });
    }

    const formData = await request.formData();
    const fgColor = formData.get("fg_color") || "#000000";
    const bgColor = formData.get("bg_color") || "#ffffff";
    const logoSize = Number.parseInt(formData.get("logo_size") || "24", 10);
    const logoFile = formData.get("logo_file") || null;

    const saved = await qrCode.upsertForUser(targetUser.id, {
      fgColor,
      bgColor,
      logoSize,
      logoFile,
    });

    // Fetch the full row with logo_url for the response
    const result = await qrCode.findByUserId(targetUser.id);
    return Response.json(result ?? saved, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
