import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function postFile(file, folder) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "image" }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      })
      .end(buffer);
  });

  return {
    id: result.public_id,
    //publicId: result.public_id,
    displayName: result.display_name,
    filename: result.original_filename,
    //folder:result.asset_folder,
    width: result.width,
    height: result.height,
    format: result.format,
    tags: result.tags,
    type: result.resource_type,
    url: result.secure_url,
    created_at: result.created_at,
  };
}

export async function destroyFile(publicId) {
  if (!publicId) {
    throw new Error("public_id não informado para exclusão");
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Erro ao remover imagem: ${result.result}`);
  }

  return result;
}

const uploadFile = {
  postFile,
  destroyFile,
};

export default uploadFile;
