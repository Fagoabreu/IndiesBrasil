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
      .upload_stream({ folder, resource_type: "image" }, (error, uploadResult) => {
        if (error) {
          const wrapped = new Error(error.message || "Falha no upload de imagem");
          wrapped.http_code = error.http_code;
          reject(wrapped);
        } else resolve(uploadResult);
      })
      .end(buffer);
  });
  return {
    id: result.asset_id,
    publicId: result.public_id,
    displayName: result.display_name,
    filename: result.original_filename,
    width: result.width,
    height: result.height,
    format: result.format,
    tags: result.tags,
    type: result.resource_type,
    url: result.secure_url,
    created_at: result.created_at,
  };
}

export async function postRawFile(file, folder) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // resource_type "image" é necessário para que o Cloudinary
  // reconheça o PDF como documento multi-página e suporte
  // transformações pg_N (conversão de página para imagem).
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "image" }, (error, uploadResult) => {
        if (error) {
          const wrapped = new Error(error.message || "Falha no upload de arquivo");
          wrapped.http_code = error.http_code;
          reject(wrapped);
        } else resolve(uploadResult);
      })
      .end(buffer);
  });
  return {
    id: result.asset_id,
    publicId: result.public_id,
    displayName: result.display_name,
    filename: result.original_filename,
    width: result.width,
    height: result.height,
    format: result.format,
    tags: result.tags,
    type: "image",
    url: result.secure_url,
    created_at: result.created_at,
  };
}

/**
 * Upload de PDF como resource_type "raw" para permitir arquivos
 * de até 100 MB no plano gratuito do Cloudinary.
 *
 * Trade-off: resource_type "raw" NÃO suporta transformações
 * pg_N. Para renderizar páginas, o BookViewer utiliza
 * <object> com #page=N em vez de imagens Cloudinary.
 */
export async function postPdfFile(file, folder) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "raw" }, (error, uploadResult) => {
        if (error) {
          const wrapped = new Error(error.message || "Falha no upload de PDF");
          wrapped.http_code = error.http_code;
          reject(wrapped);
        } else resolve(uploadResult);
      })
      .end(buffer);
  });
  return {
    id: result.asset_id,
    publicId: result.public_id,
    displayName: result.display_name,
    filename: result.original_filename,
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

export async function destroyRawFile(publicId) {
  if (!publicId) {
    throw new Error("public_id não informado para exclusão");
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Erro ao remover arquivo: ${result.result}`);
  }

  return result;
}

export async function destroyPdfFile(publicId) {
  if (!publicId) {
    throw new Error("public_id não informado para exclusão");
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Erro ao remover PDF: ${result.result}`);
  }

  return result;
}

const uploadFile = {
  postFile,
  postRawFile,
  postPdfFile,
  destroyFile,
  destroyRawFile,
  destroyPdfFile,
};

export default uploadFile;
