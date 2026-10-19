import { createRouter } from "next-connect";
import controller from "infra/controller";
import asset from "models/asset";
import uploadedImages from "models/uploadedImages";
import { ForbiddenError, ValidationError } from "infra/errors";

// A capa é enviada como data URL base64 no corpo do JSON; o limite padrão do
// bodyParser (1mb) não comporta o recorte gerado pelo ImageUploader.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("update:asset"), postHandler)
  .delete(controller.canRequest("update:asset"), deleteHandler)
  .handler(controller.errorHandlers);

/**
 * POST /api/v1/assets/[slug]/cover
 *
 * A capa é a **única** imagem que sobe para o nosso storage — o asset em si
 * continua no endereço externo. Sem capa, a página e o card usam placeholder.
 */
async function postHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;
  const { image } = request.body;

  const assetData = await asset.findBySlug(slug);

  if (!(await asset.canEdit(assetData.id, requestUser))) {
    throw new ForbiddenError({
      message: "Você não tem permissão para alterar a capa deste asset.",
    });
  }

  if (!image || typeof image !== "string") {
    throw new ValidationError({
      message: "O campo 'image' é obrigatório (data URL base64).",
    });
  }

  const uploadedImage = await uploadedImages.uploadDataUrlImage(image, `assets/${assetData.id}/cover`);
  await asset.saveCover(slug, uploadedImage.id);

  // A capa anterior deixa de ser referenciada; apagá-la do Cloudinary evita
  // arquivo órfão a cada troca.
  if (assetData.cover_image_id && assetData.cover_image_id !== uploadedImage.id) {
    try {
      await uploadedImages.deleteImage(assetData.cover_image_id);
    } catch {
      // Se a imagem antiga já não existir, a troca continua válida.
    }
  }

  return response.status(200).json({
    cover_url: uploadedImage.secure_url,
    cover_image_id: uploadedImage.id,
  });
}

async function deleteHandler(request, response) {
  const { slug } = request.query;
  const requestUser = request.context.user;

  const assetData = await asset.findBySlug(slug);

  if (!(await asset.canEdit(assetData.id, requestUser))) {
    throw new ForbiddenError({
      message: "Você não tem permissão para alterar a capa deste asset.",
    });
  }

  await asset.clearCover(slug);

  if (assetData.cover_image_id) {
    try {
      await uploadedImages.deleteImage(assetData.cover_image_id);
    } catch {
      // Arquivo já removido do Cloudinary não impede a remoção da referência.
    }
  }

  return response.status(200).json({ cover_url: null, cover_image_id: null });
}
