#!/usr/bin/env node
/**
 * Renomeia a marca no repositório (Indies Brasil → Jogos Social).
 *
 * ## Por que um script versionado e não 90 edições à mão
 *
 * A substituição é literal e o risco é deixar um arquivo de fora — o sintoma
 * seria "Indies Brasil" aparecendo no rodapé ou no assunto de um e-mail meses
 * depois do rebrand. Um codemod roda igual em toda a árvore, é revisável no
 * diff, pode ser reexecutado (é idempotente) e termina relatando o que sobrou.
 *
 * ## O que ele NÃO troca, e por quê
 *
 * As frases de `PROTECTED` contêm a marca mas são identificadores de terceiros
 * ou de infraestrutura. Trocá-las quebraria mais do que conserta:
 *
 * - `contato@indies.com.br` — caixa postal real. Trocar o endereço sem criar a
 *   nova e configurar SPF/DKIM derruba ativação de conta e reset de senha.
 * - `@indiesbrasil` — handle no X/Twitter, que não é nosso para renomear.
 * - repo, `projectKey` do Sonar — identificadores de serviços externos.
 * - `indies-app`, `indies-galene`, volumes `indies_*`, `/var/www/indies` e
 *   `indies.*.conf` — deploy. Container/volume com nome novo sem migrar dado
 *   apaga banco e certificados; isso é uma janela de manutenção própria.
 *
 * A técnica é a mesma do `lib/sanitize.js`: as frases protegidas viram
 * placeholders antes da substituição e são restauradas depois, então uma frase
 * protegida nunca é atingida por acidente.
 *
 * Uso:
 *   node scripts/rename-brand.js            # dry-run: só relata
 *   node scripts/rename-brand.js --apply    # grava
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");

const EXTENSIONS = new Set([".js", ".jsx", ".css", ".md", ".json", ".yml", ".yaml", ".sql", ".conf", ".txt", ".development"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "_bkp", "galene", ".swc", "coverage"]);
const SKIP_FILES = new Set(["package-lock.json", "rename-brand.js"]);

const PROTECTED = [
  "contato@indies.com.br",
  "test@indies.com.br",
  "@indiesbrasil",
  "github.com/Fagoabreu/IndiesBrasil",
  "Fagoabreu_IndiesBrasil",
  "indies-app",
  "indies-galene",
  "indies-migrate",
  "indies_postgres-certs",
  "indies_galene-groups",
  "indies_galene-data",
  "indies_nginx_secrets",
  "indies_private",
  "/var/www/indies",
  "indies.http.conf",
  "indies.https.conf",
  "IndiesWhatsApp.jpeg",
  "indies-brasil",
];

/** A forma com espaço vem antes da colada; a maiúscula antes da minúscula. */
const REPLACEMENTS = [
  [/\bINDIESBRASIL\b/g, "JOGOSOCIAL"],
  [/\bIndies Brasil\b/g, "Jogos Social"],
  [/\bIndiesBrasil\b/g, "Jogos Social"],
  [/\bindiesbrasil\b/g, "jogosocial"],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
      continue;
    }
    const isDotenv = entry.name.startsWith(".env");
    if (SKIP_FILES.has(entry.name)) continue;
    if (isDotenv || EXTENSIONS.has(path.extname(entry.name))) out.push(path.join(dir, entry.name));
  }
  return out;
}

/**
 * Guarda cada frase protegida atrás de um placeholder único.
 *
 * O token é textual (`@@PROTECTED0@@`) e não um caractere de controle: `\u0000`
 * funcionava como separador, mas viola a regra `no-control-regex` do lint do
 * projeto. A colisão com conteúdo real é improvável o bastante (o nome tem 12
 * caracteres e usa `@@`), e restaurar é uma passada só.
 */
function protect(text) {
  const tokens = [];
  let result = text;
  for (const phrase of PROTECTED) {
    result = result.replaceAll(phrase, () => {
      tokens.push(phrase);
      return `@@PROTECTED${tokens.length - 1}@@`;
    });
  }
  return { result, tokens };
}

function restore(text, tokens) {
  return text.replaceAll(/@@PROTECTED(\d+)@@/g, (_match, index) => tokens[Number.parseInt(index, 10)]);
}

function renameBrand(text) {
  const { result, tokens } = protect(text);
  let next = result;
  for (const [pattern, replacement] of REPLACEMENTS) next = next.replace(pattern, replacement);
  return restore(next, tokens);
}

const BRAND_PATTERN = /Indies ?Brasil|INDIESBRASIL|indiesbrasil/g;

const files = walk(ROOT).sort();
let changedFiles = 0;
let changedOccurrences = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const renamed = renameBrand(original);
  if (renamed === original) continue;

  const before = original.match(BRAND_PATTERN)?.length ?? 0;
  const after = renamed.match(BRAND_PATTERN)?.length ?? 0;
  const delta = before - after;

  changedFiles += 1;
  changedOccurrences += delta;

  const protectedNote = after ? `  (${after} protegida(s))` : "";
  console.log(`${String(delta).padStart(3)}  ${path.relative(ROOT, file)}${protectedNote}`);

  if (APPLY) fs.writeFileSync(file, renamed);
}

console.log(`\n${changedFiles} arquivo(s), ${changedOccurrences} ocorrência(s)${APPLY ? " alteradas" : " seriam alteradas"}.`);
if (!APPLY) {
  console.log("Nada foi gravado. Rode com --apply para aplicar.");
}
