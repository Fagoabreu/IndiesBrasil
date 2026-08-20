/**
 * Compressão de imagens no cliente antes do upload.
 *
 * Fotos de celular costumam ter vários MB. Redimensionar para uma dimensão
 * máxima e re-codificar em JPEG reduz drasticamente o tempo de envio em
 * conexões lentas (3G/4G fraco), mantendo qualidade aceitável para o feed.
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const MAX_SOURCE_BYTES_WITHOUT_RECOMPRESS = 1 * 1024 * 1024; // 1 MB

function isCompressibleImage(file) {
  if (!file || typeof file.type !== "string") return false;
  if (!file.type.startsWith("image/")) return false;
  // GIF animado e SVG não podem ser re-codificados sem perder recursos.
  return file.type !== "image/gif" && file.type !== "image/svg+xml";
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao carregar a imagem para compressão"));
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao codificar a imagem comprimida"));
      },
      type,
      quality,
    );
  });
}

/**
 * Redimensiona e comprime uma imagem, retornando um novo `File`.
 * Se a compressão não reduzir o tamanho (ou falhar), retorna o arquivo original.
 *
 * @param {File} file Arquivo de imagem selecionado pelo usuário.
 * @param {{ maxDimension?: number, quality?: number }} [options]
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
  const { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = options;

  if (!isCompressibleImage(file)) return file;

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const { naturalWidth: width, naturalHeight: height } = image;
    const largest = Math.max(width, height);

    // Já pequena e dentro do limite — não vale a pena re-codificar.
    if (largest <= maxDimension && file.size <= MAX_SOURCE_BYTES_WITHOUT_RECOMPRESS) {
      return file;
    }

    const scale = largest > maxDimension ? maxDimension / largest : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    // Preserva transparência apenas para PNG; demais formatos viram JPEG.
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

    if (outputType === "image/jpeg") {
      // Evita fundo preto em imagens com canal alfa convertidas para JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas, outputType, quality);

    if (!blob || blob.size >= file.size) {
      // A compressão não ajudou — mantém o original.
      return file;
    }

    const extension = outputType === "image/png" ? "png" : "jpg";
    const baseName = (file.name || "imagem").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch (error) {
    // Falha ao decodificar (ex.: HEIC sem suporte): envia o original sem quebrar o fluxo.
    console.warn("Falha ao comprimir imagem, enviando original:", error);
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
