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

console.log(failures ? `\nFALHAS: ${failures}` : "\nOK");
process.exit(failures ? 1 : 0);
