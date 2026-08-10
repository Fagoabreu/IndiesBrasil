import uploadFile from "@/infra/uploadFile.js";
import database from "infra/database.js";

function buildUploadFolder(subfolder) {
  const env = process.env.NODE_ENV === "production" ? "PROD" : "DEV";
  return process.env.FILE_UPLOAD_BASE_FOLDER + "/" + env + "/" + (subfolder ?? "DEFAULT");
}

async function uploadImage(file, subfolder) {
  if (!file) return null;
  const uploadedResult = await uploadFile.postFile(file, buildUploadFolder(subfolder));
  return await saveImage(uploadedResult);
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
  await uploadFile.destroyFile(id);
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
  uploadPdf,
  uploadPdfRaw,
  deleteImage,
  saveImage,
  findById,
};

export default uploadedImages;
