/**
 * Verifica duas coisas que as instruções de IA passaram a exigir:
 *
 * 1. As seções de instruções são idênticas nos dois arquivos (CLAUDE.md e
 *    .deepseek/instructions.md) — eles já divergiram no passado.
 * 2. Todo `preset="..."` usado no código existe em `lib/image-presets.js`, e
 *    todo preset do catálogo é usado em algum lugar (preset morto é sinal de
 *    formato que ninguém aplica mais).
 *
 * Uso: node scripts/audit-image-presets.js
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage", "public", "docs", "deploy"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let failures = 0;

// ── 1. Instruções sincronizadas ──
const SECTION = "## Upload de imagem (obrigatorio)";
const files = ["CLAUDE.md", ".deepseek/instructions.md"];

function sectionOf(file) {
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf(SECTION);
  if (start < 0) return null;
  // Até a próxima seção de nível 2
  const rest = text.slice(start + SECTION.length);
  const next = rest.indexOf("\n## ");
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

const sections = files.map((f) => ({ file: f, body: sectionOf(f) }));

console.log("── Instruções ──");
for (const { file, body } of sections) {
  if (body) console.log(`  ${file}: secao presente (${body.split("\n").length} linhas)`);
  else {
    console.log(`  ERRO: ${file} nao tem a secao "${SECTION}"`);
    failures++;
  }
}

if (sections.every((s) => s.body)) {
  const [a, b] = sections;
  if (a.body === b.body) console.log("  OK: as duas secoes sao identicas");
  else {
    console.log(`  ERRO: as secoes divergem (${a.file} vs ${b.file})`);
    failures++;
  }
}

// ── 2. Presets usados x declarados ──
const { IMAGE_PRESETS } = require(path.join(ROOT, "lib/image-presets.js"));
const declared = Object.keys(IMAGE_PRESETS);

const used = new Map();
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("lib/image-presets")) continue;
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(/preset=["']([A-Za-z0-9_]+)["']/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(rel);
  }
}

console.log("\n── Presets ──");
for (const name of used.keys()) {
  const where = used.get(name);
  if (declared.includes(name)) {
    console.log(`  ${name}: usado em ${where.length} lugar(es) — ${[...new Set(where)].join(", ")}`);
  } else {
    console.log(`  ERRO: preset "${name}" usado mas NAO existe no catalogo — ${[...new Set(where)].join(", ")}`);
    failures++;
  }
}

const unused = declared.filter((d) => !used.has(d));
if (unused.length) {
  console.log(`  AVISO: presets declarados e nao usados -> ${unused.join(", ")}`);
}

// ── 3. Proporção declarada no CSS x preset ──
// O preset nasce da proporção em que a imagem é EXIBIDA. Quando o CSS define uma
// altura fixa, a caixa muda de proporção conforme a largura da tela e o
// `object-fit: cover` descarta o que o usuário enquadrou — foi assim que a capa
// do evento (recorte 5,77:1) passou a mostrar só o miolo no card da agenda
// (~2,2:1) e no preview do formulário (~3:1).
//
// Pares superfície↔preset em que a fidelidade do enquadramento importa. Só entra
// aqui superfície cujo recorte o usuário escolhe à mão no formulário.
const RATIO_SURFACES = [
  { preset: "eventBanner", css: "components/Agenda/EventCard.module.css", selector: ".eventBanner" },
  { preset: "eventBanner", css: "components/Agenda/EventBannerField.module.css", selector: ".bannerPreviewWrap" },
  { preset: "eventBanner", css: "pages/agenda/[id]/index.module.css", selector: ".bannerWrap" },
  { preset: "eventBanner", css: "pages/agenda/[id]/index.module.css", selector: ".bannerPlaceholder" },
];

/** Corpo de cada bloco de regra do seletor, inclusive dentro de @media.
 *  Comentários são removidos antes: eles citam nomes de classe e `indexOf`
 *  sozinho confundiria a menção no comentário com a regra. */
function ruleBlocks(cssText, selector) {
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [];
  let from = 0;

  for (;;) {
    const at = clean.indexOf(selector, from);
    if (at < 0) break;

    const open = clean.indexOf("{", at + selector.length);
    const close = clean.indexOf("}", open);
    blocks.push(open > 0 && close > open ? clean.slice(open + 1, close) : null);
    from = at + selector.length;
  }

  return blocks.filter((block) => block !== null);
}

console.log("\n── Proporção do CSS x preset ──");
for (const { preset, css, selector } of RATIO_SURFACES) {
  const expected = IMAGE_PRESETS[preset].aspect;
  const where = `${css} ${selector}`;
  const blocks = ruleBlocks(fs.readFileSync(path.join(ROOT, css), "utf8"), selector);

  if (!blocks.length) {
    console.log(`  ERRO: ${where} nao encontrado`);
    failures++;
    continue;
  }

  for (const body of blocks) {
    const ratio = body.match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);

    if (!ratio) {
      const fixedHeight = body.match(/(?:^|\s)height:\s*([^;]+);/);
      console.log(
        `  ERRO: ${where} nao declara aspect-ratio${fixedHeight ? ` (usa height: ${fixedHeight[1].trim()})` : ""} — a caixa muda de proporcao com a largura e corta o enquadramento`,
      );
      failures++;
      continue;
    }

    const value = Number(ratio[1]) / Number(ratio[2]);
    if (Math.abs(value - expected) / expected > 0.01) {
      console.log(`  ERRO: ${where} = ${value.toFixed(2)}:1, mas o preset "${preset}" e ${expected.toFixed(2)}:1`);
      failures++;
    } else {
      console.log(`  ${where}: ${value.toFixed(2)}:1 = preset "${preset}"`);
    }
  }
}

// ── 4. Arte do site (preview de link e home) ──
// `DEFAULT_OG_IMAGE` e `OG_COVER_ART` (lib/seo.js) são o MESMO desenho em dois
// arquivos: o JPEG opaco é a capa de todo preview de link (e apontava para
// `/images/og-cover.png`, que não existia: em produção respondia 404 e essas
// páginas eram compartilhadas sem imagem); o PNG tem a sobra transparente e é o
// que a home exibe. Referência a arquivo estático não faz o build falhar, então
// as checagens vivem aqui.
//
// O que se confere: os dois arquivos existem, têm o mesmo canvas, o canvas bate
// com `OG_IMAGE_SIZE` publicado em `og:image:width/height`, a proporção do JPEG
// é a que as redes recortam (1,91:1) e o `aspect-ratio` que o card da home
// declara para o PNG é o do CONTEÚDO da arte (a moldura, sem a sobra). Essa
// última checagem nasceu de um caso real: com a arte centralizada num canvas
// largo, o `aspect-ratio` errado mostrava a arte pequena com faixas vazias nas
// laterais do card.
const { DEFAULT_OG_IMAGE, OG_COVER_ART, OG_IMAGE_SIZE } = require(path.join(ROOT, "lib/seo.js"));

/** Proporção do card de preview das redes (1200x630) — a que a arte precisa ter. */
const OG_CARD_RATIO = 1200 / 630;
/** Folga da proporção do canvas: arte desenhada à mão não cai no número exato. */
const OG_RATIO_TOLERANCE = 0.02;
/** Folga da proporção da moldura: antialiasing e sombra suave mexem alguns px. */
const ART_RATIO_TOLERANCE = 0.01;
/** Menor alfa que conta como pixel da arte (descarta o halo do antialiasing). */
const ART_ALPHA_MIN = 8;

/** Caminho em `public/` da URL usada no código (aceita caminho ou URL absoluta). */
function publicFile(url) {
  return path.join(ROOT, "public", url.replace(/^https?:\/\/[^/]+/, ""));
}

/**
 * Largura e altura lidas do cabeçalho do arquivo, sem dependência.
 *
 * `sharp` resolveria, mas é assíncrono e este script é síncrono de ponta a
 * ponta. São dois formatos só (JPEG, o da imagem padrão; PNG, o dos presets) e
 * os dois guardam as medidas em bytes fixos de posição conhecida.
 *
 * @returns {{ width: number, height: number } | null}
 */
function imageSize(file) {
  const buffer = fs.readFileSync(file);

  // PNG: assinatura de 8 bytes, depois chunk IHDR com largura e altura em uint32 BE.
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG: percorre os segmentos até um marcador SOF, que traz as dimensões.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];
      // SOF0..SOF15, exceto os marcadores que não são frame (0xc4, 0xc8, 0xcc).
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };

      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  return null;
}

/**
 * Caixa do desenho dentro do canvas, medida pelo canal alfa do PNG.
 *
 * A sobra lateral da arte não tem pixel nenhum (é transparente), então o
 * primeiro e o último pixel opacos são a borda da moldura. Medir em vez de
 * confiar num número escrito à mão é o que permite o `aspect-ratio` do card da
 * home ser conferido contra o arquivo.
 *
 * @returns {Promise<{ x: number, y: number, width: number, height: number } | null>}
 */
async function artContentBox(file) {
  const sharp = require("sharp");
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] <= ART_ALPHA_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Lê o `aspect-ratio` que um seletor de um CSS Module declara. */
function cssAspectRatio(file, selector) {
  const blocks = ruleBlocks(fs.readFileSync(path.join(ROOT, file), "utf8"), selector);
  for (const body of blocks) {
    const ratio = body.match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    if (ratio) return { raw: `${ratio[1]} / ${ratio[2]}`, value: Number(ratio[1]) / Number(ratio[2]) };
  }
  return null;
}

/** Arquivos da arte do site, na ordem em que são checados. */
const SITE_ART_FILES = [
  { label: "preview de link", url: DEFAULT_OG_IMAGE, file: publicFile(DEFAULT_OG_IMAGE) },
  { label: "home", url: OG_COVER_ART, file: publicFile(OG_COVER_ART) },
];

async function checkSiteArt() {
  const sharp = require("sharp");
  console.log("\n── Arte do site (preview de link e home) ──");

  const sizes = new Map();

  for (const { label, url, file } of SITE_ART_FILES) {
    if (!fs.existsSync(file)) {
      console.log(`  ERRO: ${label} aponta para ${url}, que nao existe em public/ — a pagina e servida sem a arte`);
      failures++;
      continue;
    }

    const size = imageSize(file);
    if (!size) {
      console.log(`  ERRO: nao consegui ler as dimensoes de ${url}`);
      failures++;
      continue;
    }

    sizes.set(label, size);
    console.log(`  ${label}: ${url} ${size.width}x${size.height}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }

  const og = sizes.get("preview de link");
  const art = sizes.get("home");

  if (og && art && (og.width !== art.width || og.height !== art.height)) {
    console.log(
      `  ERRO: os dois arquivos da arte tem canvas diferente (${og.width}x${og.height} no preview, ${art.width}x${art.height} na home) — sao o mesmo desenho e o recorte do card foi medido num canvas so`,
    );
    failures++;
  }

  if (og) {
    const ratio = og.width / og.height;

    if (og.width !== OG_IMAGE_SIZE.width || og.height !== OG_IMAGE_SIZE.height) {
      console.log(
        `  ERRO: o padrao de preview e ${og.width}x${og.height}, mas o declarado em og:image é ${OG_IMAGE_SIZE.width}x${OG_IMAGE_SIZE.height}`,
      );
      failures++;
    } else if (Math.abs(ratio - OG_CARD_RATIO) / OG_CARD_RATIO > OG_RATIO_TOLERANCE) {
      console.log(
        `  ERRO: o padrao de preview e ${og.width}x${og.height} (${ratio.toFixed(2)}:1), mas as redes recortam em ~${OG_CARD_RATIO.toFixed(2)}:1 — o recorte come a moldura da arte`,
      );
      failures++;
    } else {
      console.log(`  proporcao do padrao de preview: ${ratio.toFixed(2)}:1 = recorte das redes`);
    }
  }

  if (!art) return;

  const artFile = SITE_ART_FILES[1].file;
  const { hasAlpha } = await sharp(artFile).metadata();
  if (!hasAlpha) {
    console.log(
      `  ERRO: ${OG_COVER_ART} e opaco — a home precisa da sobra transparente, senao o card mostra faixa branca nas laterais (o JPEG serve o preview de link)`,
    );
    failures++;
  }

  const box = await artContentBox(artFile);
  if (!box) {
    console.log(`  ERRO: ${OG_COVER_ART} e transparente por inteiro — nao ha desenho para o card da home exibir`);
    failures++;
    return;
  }

  const declared = cssAspectRatio("pages/index.module.css", ".promoCard");
  const contentRatio = box.width / box.height;
  const rightGap = art.width - (box.x + box.width);

  console.log(`  desenho dentro do canvas: ${box.width}x${box.height} (${contentRatio.toFixed(2)}:1), sobra lateral de ${box.x} e ${rightGap} px`);

  if (!declared) {
    console.log(
      "  ERRO: pages/index.module.css .promoCard nao declara aspect-ratio — o card volta a exibir o canvas inteiro, com as faixas vazias nas laterais",
    );
    failures++;
    return;
  }

  if (Math.abs(rightGap - box.x) > art.width * ART_RATIO_TOLERANCE) {
    console.log(
      `  ERRO: o desenho nao esta centralizado no canvas (sobra de ${box.x} px a esquerda e ${rightGap} px a direita) — o recorte do card da home corta um lado mais que o outro`,
    );
    failures++;
  }

  if (Math.abs(declared.value - contentRatio) / contentRatio > ART_RATIO_TOLERANCE) {
    console.log(
      `  ERRO: pages/index.module.css .promoCard declara aspect-ratio: ${declared.raw} (${declared.value.toFixed(2)}:1), mas o desenho de ${OG_COVER_ART} e ${contentRatio.toFixed(2)}:1 — o card corta a arte fora de esquadro (sobra nas laterais ou moldura cortada)`,
    );
    failures++;
  } else {
    console.log(`  pages/index.module.css .promoCard: ${declared.raw} = desenho de ${OG_COVER_ART}`);
  }
}

checkSiteArt()
  .catch((error) => {
    console.log(`  ERRO: nao consegui conferir a arte do site (${error.message})`);
    failures++;
  })
  .finally(() => {
    console.log(failures ? `\nFALHAS: ${failures}` : "\nOK");
    process.exit(failures ? 1 : 0);
  });
