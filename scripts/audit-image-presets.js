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

// ── 4. Imagem padrão de preview de link ──
// `OG_COVER_IMAGE` (lib/seo.js) é a arte do site: a mesma imagem da home e a
// capa padrão de toda página que não informa `ogImage` (listagens, por exemplo).
// Ela apontava para `/images/og-cover.png`, que não existia: em produção o
// arquivo respondia 404 e todas essas páginas eram compartilhadas sem imagem.
// Referência a arquivo estático não faz o build falhar, então a checagem vive
// aqui — e cobre também as medidas e a proporção, que antes eram garantidas pelo
// gerador (`scripts/build-og-cover.js`) e hoje dependem de quem troca a arte.
const { DEFAULT_OG_IMAGE, OG_IMAGE_SIZE } = require(path.join(ROOT, "lib/seo.js"));

/** Proporção do card de preview das redes (1200x630) — a que a arte precisa ter. */
const OG_CARD_RATIO = 1200 / 630;
/** Folga da proporção: arte desenhada à mão não cai no número exato. */
const OG_RATIO_TOLERANCE = 0.02;

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

console.log("\n── Imagem padrão de preview ──");
{
  const pathname = DEFAULT_OG_IMAGE.replace(/^https?:\/\/[^/]+/, "");
  const file = path.join(ROOT, "public", pathname);

  if (!fs.existsSync(file)) {
    console.log(`  ERRO: og:image padrao aponta para ${pathname}, que nao existe em public/ — o link e compartilhado sem imagem`);
    failures++;
  } else {
    const size = imageSize(file);
    const kb = (fs.statSync(file).size / 1024).toFixed(0);

    if (!size) {
      console.log(`  ERRO: nao consegui ler as dimensoes de ${pathname}`);
      failures++;
    } else {
      const ratio = size.width / size.height;

      if (size.width !== OG_IMAGE_SIZE.width || size.height !== OG_IMAGE_SIZE.height) {
        console.log(`  ERRO: ${pathname} e ${size.width}x${size.height}, mas o declarado em og:image é ${OG_IMAGE_SIZE.width}x${OG_IMAGE_SIZE.height}`);
        failures++;
      } else if (Math.abs(ratio - OG_CARD_RATIO) / OG_CARD_RATIO > OG_RATIO_TOLERANCE) {
        console.log(
          `  ERRO: ${pathname} e ${size.width}x${size.height} (${ratio.toFixed(2)}:1), mas a arte do site precisa ser ~${OG_CARD_RATIO.toFixed(2)}:1 — o card e recortado no centro pelas redes e os elementos das laterais somem`,
        );
        failures++;
      } else {
        console.log(`  ${pathname}: ${size.width}x${size.height} (${ratio.toFixed(2)}:1), ${kb} KB = declarado em og:image`);
      }
    }
  }
}

console.log(failures ? `\nFALHAS: ${failures}` : "\nOK");
process.exit(failures ? 1 : 0);
