import uploadFile from "@/infra/uploadFile.js";
import database from "infra/database.js";
import { ValidationError } from "infra/errors.js";

function buildUploadFolder(subfolder) {
  const env = process.env.NODE_ENV === "production" ? "PROD" : "DEV";
  return process.env.FILE_UPLOAD_BASE_FOLDER + "/" + env + "/" + (subfolder ?? "DEFAULT");
}

async function uploadImage(file, subfolder) {
  if (!file) return null;
  const uploadedResult = await uploadFile.postFile(file, buildUploadFolder(subfolder));
  return await saveImage(uploadedResult);
}

const DATA_URL_REGEX = /^data:image\/(\w+);base64,(.+)$/;

/**
 * Decodifica um data URL base64 e envia a imagem ao Cloudinary.
 * Centraliza a conversão (data URL -> Blob -> upload) usada em vários
 * fluxos de upload por JSON (análises, cursos, loja).
 */
async function uploadDataUrlImage(dataUrl, subfolder) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new ValidationError({ message: "A imagem é obrigatória (data URL base64)." });
  }

  const match = DATA_URL_REGEX.exec(dataUrl);
  if (!match) {
    throw new ValidationError({ message: "Formato de imagem inválido. Envie um data URL base64." });
  }

  const buffer = Buffer.from(match[2], "base64");
  const blob = new Blob([buffer], { type: `image/${match[1]}` });

  return await uploadImage(blob, subfolder);
}

async function saveImage(uploadedResult) {
  const results = await database.query({
    text: `
      insert into uploaded_images (
        id,
        public_id,
        display_name,
        filename,
        width,
        height,
        format,
        tags,
        resource_type,
        secure_url,
        created_at
      )
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning
        *
      `,
    values: [
      uploadedResult.id,
      uploadedResult.publicId,
      uploadedResult.displayName,
      uploadedResult.filename,
      uploadedResult.width,
      uploadedResult.height,
      uploadedResult.format,
      uploadedResult.tags,
      uploadedResult.type,
      uploadedResult.url,
      uploadedResult.created_at,
    ],
  });

  return results.rows[0];
}

async function deleteImage(id) {
  // `uploaded_images.id` é o `asset_id` do Cloudinary, mas `destroyFile`
  // espera o `public_id`. Busca o registro para excluir o arquivo correto.
  const existing = await findById(id);
  if (existing?.public_id) {
    await uploadFile.destroyFile(existing.public_id);
  }

  const results = await database.query({
    text: `
      delete from uploaded_images
      where id = $1
      returning *
    `,
    values: [id],
  });

  return results.rows[0];
}

async function uploadPdf(file, subfolder) {
  if (!file) return null;
  const uploadedResult = await uploadFile.postRawFile(file, buildUploadFolder(subfolder));
  // Reutiliza saveImage — a estrutura da tabela uploaded_images é a mesma
  return await saveImage(uploadedResult);
}

async function uploadPdfRaw(file, subfolder) {
  if (!file) return null;
  const uploadedResult = await uploadFile.postPdfFile(file, buildUploadFolder(subfolder));
  return await saveImage(uploadedResult);
}

async function findById(id) {
  const results = await database.query({
    text: `
      select *
      from uploaded_images
      where id = $1
    `,
    values: [id],
  });
  return results.rows[0];
}

const uploadedImages = {
  uploadImage,
  uploadDataUrlImage,
  uploadPdf,
  uploadPdfRaw,
  deleteImage,
  saveImage,
  findById,
};

export default uploadedImages;
