import { createRouter } from "next-connect";
import controller from "infra/controller";
import course from "models/course";
import uploadedImages from "models/uploadedImages";
import { ValidationError } from "infra/errors";

// A capa é enviada como data URL base64 no corpo do JSON; o limite padrão
// do bodyParser (1mb) não comporta PNGs recortados.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

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

  const uploadedImage = await uploadedImages.uploadDataUrlImage(image, `courses/${slug}`);
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
