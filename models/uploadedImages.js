import uploadFile from "@/infra/uploadFile.js";
import database from "infra/database.js";

async function uploadImage(file, subfolder) {
  if (!file) return null;
  const uploadFolder =
    process.env.FILE_UPLOAD_BASE_FOLDER + "/" + (process.env.NODE_ENV === "production" ? "PROD" : "DEV") + "/" + (subfolder ?? "DEFAULT");
  const uploadedResult = await uploadFile.postFile(file, uploadFolder);

  return await saveImage(uploadedResult, subfolder);
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

const uploadedImages = {
  uploadImage,
  deleteImage,
  saveImage,
};

export default uploadedImages;
