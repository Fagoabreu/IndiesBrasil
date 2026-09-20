function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.setAttribute("crossOrigin", "anonymous");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = url;
  });
}

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);

  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),

    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export async function generateImage({
  imageSrc,
  crop,
  rotation = 0,
  shape = 0,
  brightness = 100,
  contrast = 100,
  saturation = 100,
  format = "image/png",
  quality = 0.9,
  outputWidth,
}) {
  const image = await createImage(imageSrc);

  const rotRad = getRadianAngle(rotation);

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.filter = `
    brightness(${brightness}%)
    contrast(${contrast}%)
    saturate(${saturation}%)
  `;

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  // Alvo de largura vem do preset (`lib/image-presets.js`), então cada tipo de
  // imagem sai num tamanho previsível. Quem chama sem `outputWidth` (a
  // ferramenta de recorte livre) mantém o teto antigo de 1600px.
  // O teto absoluto é rede de segurança: algumas rotas enviam a imagem como
  // base64 (análises, cursos) e um payload gigante estoura o bodyParser.
  // Nunca faz upscale — fonte menor que o alvo mantém o tamanho original.
  const DEFAULT_MAX_DIMENSION = 1600;
  const ABSOLUTE_MAX_DIMENSION = 2000;
  const target = outputWidth > 0 ? outputWidth : DEFAULT_MAX_DIMENSION;
  const targetWidth = Math.min(target, ABSOLUTE_MAX_DIMENSION);
  const downscale = Math.min(1, targetWidth / crop.width);
  const outputWidthPx = Math.max(1, Math.round(crop.width * downscale));
  const outputHeight = Math.max(1, Math.round(crop.height * downscale));

  croppedCanvas.width = outputWidthPx;
  croppedCanvas.height = outputHeight;

  croppedCtx.save();

  if (shape > 0) {
    const radius = (Math.min(outputWidthPx, outputHeight) / 2) * (shape / 100);

    croppedCtx.beginPath();
    croppedCtx.moveTo(radius, 0);
    croppedCtx.lineTo(croppedCanvas.width - radius, 0);
    croppedCtx.quadraticCurveTo(croppedCanvas.width, 0, croppedCanvas.width, radius);
    croppedCtx.lineTo(croppedCanvas.width, croppedCanvas.height - radius);
    croppedCtx.quadraticCurveTo(croppedCanvas.width, croppedCanvas.height, croppedCanvas.width - radius, croppedCanvas.height);
    croppedCtx.lineTo(radius, croppedCanvas.height);
    croppedCtx.quadraticCurveTo(0, croppedCanvas.height, 0, croppedCanvas.height - radius);
    croppedCtx.lineTo(0, radius);
    croppedCtx.quadraticCurveTo(0, 0, radius, 0);
    croppedCtx.closePath();
    croppedCtx.clip();
  }
  croppedCtx.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, outputWidthPx, outputHeight);

  croppedCtx.restore();

  return new Promise((resolve) => {
    croppedCanvas.toBlob(
      (blob) => {
        resolve({
          url: URL.createObjectURL(blob),
          size: Math.round(blob.size / 1024),
          blob,
        });
      },
      format,
      quality,
    );
  });
}
