/**
 * Gera a imagem de capa padrão dos previews de link (`og:image`).
 *
 * Uso: `node scripts/build-og-cover.js`
 *
 * ## Por que um arquivo e não uma rota
 *
 * As demais imagens de Open Graph (`pages/api/og/**`) são rotas porque cada uma
 * desenha dados de uma entidade (perfil, post, evento, estúdio). Esta não tem
 * dado nenhum: é a marca fixa do site, usada como padrão por toda página que não
 * informa `ogImage` — a home e as listagens (jogos, estúdios, agenda, notícias,
 * membros, loja, streams...). Um arquivo estático é o formato certo aqui, e é o
 * que `DEFAULT_OG_IMAGE` (`lib/seo.js`) já pressupunha.
 *
 * Este script existe para a imagem ser **reproduzível**: sem ele o arquivo no
 * repositório seria um binário sem origem declarada, e ninguém saberia como
 * refazê-lo quando a arte da marca mudar.
 *
 * ## Por que a arte não é recortada
 *
 * `public/images/ArteSite.png` é quadrada (1254x1254) e a frase "JUNTOS SOMOS
 * MAIS FORTES" ocupa a altura inteira. Um recorte central em 1200x630 (1,91:1)
 * corta o "JUNTOS" ao meio — verificado. Então a arte entra **inteira**
 * (`contain`), na altura total do card, e o que sobra nas laterais é preenchido
 * por uma cópia desfocada e escurecida dela mesma: sem tarja, sem corte e sem
 * perder nenhum elemento.
 *
 * ## Por que JPEG
 *
 * O mesmo card em PNG deu cerca de 1 MB (a arte é uma ilustração densa, que é o
 * pior caso para o PNG). Em JPEG fica ~110 KB, e o preview de link tem limite de
 * tamanho — 1 MB é risco desnecessário para uma imagem que não tem transparência.
 */
const path = require("node:path");
const fs = require("node:fs");
const sharp = require("sharp");

// Mesmas medidas de `lib/og-image.js` (OG_WIDTH/OG_HEIGHT). Duplicadas porque
// aquele módulo é ESM e importa o guard de SSRF; aqui só os dois números são
// necessários.
const WIDTH = 1200;
const HEIGHT = 630;

const SOURCE = path.join(process.cwd(), "public", "images", "ArteSite.png");
const TARGET = path.join(process.cwd(), "public", "images", "og-cover.jpg");

/** Escurecimento do fundo: o suficiente para a arte se destacar sem virar tarja preta. */
const BACKGROUND_BRIGHTNESS = 0.42;
const BACKGROUND_BLUR = 48;

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Arte de origem nao encontrada: ${SOURCE}`);
    process.exit(1);
  }

  // Fundo: a própria arte preenchendo o card, desfocada e escurecida.
  const background = await sharp(SOURCE)
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .blur(BACKGROUND_BLUR)
    .modulate({ brightness: BACKGROUND_BRIGHTNESS })
    .toBuffer();

  // Frente: a arte inteira, na altura do card, centrada.
  const foreground = await sharp(SOURCE).resize({ height: HEIGHT, fit: "contain" }).toBuffer();

  const output = await sharp(background)
    .composite([{ input: foreground, gravity: "centre" }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  fs.writeFileSync(TARGET, output);

  const { width, height } = await sharp(output).metadata();
  const kb = (output.length / 1024).toFixed(0);
  console.log(`gerado: ${path.relative(process.cwd(), TARGET)} — ${width}x${height}, ${kb} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
