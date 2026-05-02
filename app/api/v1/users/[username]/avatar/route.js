import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import authorization from "@/models/authorization";
import profile from "@/models/profile";
import user from "@/models/user";

export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    const searchParams = request.nextUrl.searchParams;
    const targetUserName = searchParams.get("username");
    const targetUser = await user.getUserByUsername(targetUserName);

    if (!authorization.can(requestUser, "update:user", targetUser)) {
      throw new ForbiddenError({
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "update:user" para executar esta ação.',
      });
    }

    const formData = await request.formData();
    const imgType = formData.get("imgType") || "avatar_image"; // Pode ser "avatar_image" ou "background_image".
    const file = formData.get("file");

    const userInputValues = {
      user_id: targetUser.id,
    };

    if (file) {
      const imageData = await uploadedImages.uploadImage(file, `users/${targetUser.id}/${imgType}`);
      if (imgType === "avatar_image") {
        userInputValues.avatar_image = imageData.id;
      } else if (imgType === "background_image") {
        userInputValues.background_image = imageData.id;
      }
    }

    const resultImage = await profile.saveImages(userInputValues, targetUser.id);
    const secureOutputValues = await authorization.filterOutput(user, "read:user", resultImage);

    return Response.json(secureOutputValues, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
