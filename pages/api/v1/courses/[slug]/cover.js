import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";
import uploadedImages from "models/uploadedImages";
import { ValidationError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("update:course"), postHandler)
  .delete(controller.canRequest("update:course"), deleteHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  const { image } = request.body;

  if (!image || typeof image !== "string") {
    throw new ValidationError({
      message: "O campo 'image' é obrigatório (data URL base64).",
    });
  }

  // Decodifica o data URL base64
  const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    throw new ValidationError({
      message: "Formato de imagem inválido. Envie um data URL base64.",
    });
  }

  const buffer = Buffer.from(match[2], "base64");
  const blob = new Blob([buffer], { type: `image/${match[1]}` });

  const uploadedImage = await uploadedImages.uploadImage(blob, `courses/${slug}`);
  await course.updateCoverImage(slug, requestUser.id, uploadedImage.id);

  return response.status(200).json({
    cover_url: uploadedImage.secure_url,
    cover_image_id: uploadedImage.id,
  });
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  await course.removeCoverImage(slug, requestUser.id);

  return response.status(200).json({
    cover_url: null,
    cover_image_id: null,
  });
}
