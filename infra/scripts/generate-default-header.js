/**
 * Gera /public/images/default_header.png — capa de perfil padrão.
 *
 * Sem dependências externas: usa apenas 'zlib' e 'fs' nativos do Node.js.
 * Execute:  node infra/scripts/generate-default-header.js
 */

const { deflateSync } = require("zlib");
const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

// ─── Dimensões ───────────────────────────────────────────────────────────────
const W = 1200;
const H = 300;

// ─── Paleta (estilo visual Indies Brasil — dark/gaming) ──────────────────────
// Canto superior-esquerdo: roxo profundo #1c0b3a
// Canto inferior-direito:  azul marinho escuro #060d1a
const C0 = { r: 28, g: 11, b: 58 };
const C1 = { r: 6, g: 13, b: 26 };

// Cor do acento (roxo vibrante, para linhas de grid) #6e3dc0
const ACC = { r: 110, g: 61, b: 192 };

// ─── Pixel helper ────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Pseudo-hash determinístico para "estrelas"
function hash2(x, y) {
  let h = ((x * 374761393 + y * 668265263) >>> 0) * 1234567891;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

// ─── Construção de pixels (RGB, 3 bytes/px) ──────────────────────────────────
const rawRows = [];

for (let y = 0; y < H; y++) {
  const row = [0]; // byte de filtro PNG: None

  for (let x = 0; x < W; x++) {
    const tx = x / (W - 1);
    const ty = y / (H - 1);

    // Gradiente diagonal
    const t = tx * 0.55 + ty * 0.45;

    let r = lerp(C0.r, C1.r, t);
    let g = lerp(C0.g, C1.g, t);
    let b = lerp(C0.b, C1.b, t);

    // Linhas de scan horizontais (a cada 4 px, tom levemente mais escuro)
    if (y % 4 === 0) {
      r = Math.max(0, r - 4);
      g = Math.max(0, g - 3);
      b = Math.max(0, b - 8);
    }

    // Grid sutil (a cada 60 px, linha de acento muito suave)
    const onGridX = x % 60 === 0;
    const onGridY = y % 60 === 0;
    if (onGridX || onGridY) {
      r = Math.min(255, r + Math.round((ACC.r - r) * 0.18));
      g = Math.min(255, g + Math.round((ACC.g - g) * 0.18));
      b = Math.min(255, b + Math.round((ACC.b - b) * 0.22));
    }

    // Estrelas/partículas esparsas
    const h = hash2(x, y);
    if (h > 0.9985) {
      // ponto brilhante
      const brightness = Math.round(120 + h * 135);
      r = Math.min(255, r + brightness);
      g = Math.min(255, g + Math.round(brightness * 0.75));
      b = Math.min(255, b + brightness);
    }

    row.push(r & 0xff, g & 0xff, b & 0xff);
  }

  rawRows.push(Buffer.from(row));
}

const rawData = Buffer.concat(rawRows);
const compressed = deflateSync(rawData, { level: 9 });

// ─── Encoder PNG mínimo ───────────────────────────────────────────────────────
function u32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

// Tabela CRC-32 (IEEE 802.3)
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = -1;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBytes, data]);
  return Buffer.concat([
    u32be(data.length),
    typeBytes,
    data,
    u32be(crc32(payload)),
  ]);
}

// IHDR
const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: RGB truecolor
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filter
ihdr[12] = 0; // non-interlaced

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const png = Buffer.concat([
  PNG_SIG,
  makeChunk("IHDR", ihdr),
  makeChunk("IDAT", compressed),
  makeChunk("IEND", Buffer.alloc(0)),
]);

// ─── Escrita em disco ─────────────────────────────────────────────────────────
const outDir = join(process.cwd(), "public", "images");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "default_header.png");
writeFileSync(outPath, png);

console.log(`✓ Gerado: ${outPath}`);
console.log(
  `  Dimensões: ${W}×${H}px | Tamanho: ${(png.length / 1024).toFixed(1)} KB`,
);
