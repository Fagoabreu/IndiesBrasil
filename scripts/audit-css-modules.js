/**
 * Auditoria estática de CSS Modules: para cada arquivo, resolve os imports de
 * .module.css e confere se toda classe usada no JSX existe de fato no CSS.
 *
 * Classe ausente vira `undefined` no className — o estilo simplesmente não
 * aplica, sem erro em build nem em lint. Foi assim que o estado ativo dos dias
 * da semana ficou quebrado (usava `styles.active`, que não existia).
 *
 * Uso: node scripts/audit-css-modules.js [arquivos...]
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

// Mesmos aliases de jsconfig.json — sem isso o script não enxergaria imports
// como `@/components/Agenda/EventForm.module.css`.
const ALIASES = { "@": ".", infra: "infra", models: "models", lib: "lib", utils: "utils", context: "context" };

const DEFAULT_FILES = [
  "components/Agenda/EventForm.jsx",
  "components/Agenda/EventBannerField.jsx",
  "components/Agenda/EventCard.jsx",
  "components/Agenda/StudioMeetingList.jsx",
  "pages/agenda/criar.js",
  "pages/agenda/index.js",
  "pages/agenda/[id]/editar.js",
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;

function resolveImport(fromDir, specifier) {
  if (specifier.startsWith(".")) return path.resolve(fromDir, specifier);

  const [scope, ...rest] = specifier.split("/");
  const base = ALIASES[scope];
  return base ? path.resolve(ROOT, base, rest.join("/")) : null;
}

/**
 * Nomes de classe definidos no CSS.
 *
 * A linha é aparada antes da regex porque uma classe definida dentro de
 * `@media` vem indentada — e continua sendo exportada pelo CSS Module. Sem o
 * `trim`, toda classe que só existe dentro de um `@media` aparecia como
 * "usada e não definida", um falso positivo.
 *
 * Só o PRIMEIRO nome de um seletor composto é capturado: em `.a.b`, o CSS
 * Module não cria `styles.b` (é a origem do `className="undefined"` que este
 * script existe para pegar), e a regex precisa continuar reproduzindo isso.
 */
function topLevelClasses(cssPath) {
  const css = fs.readFileSync(cssPath, "utf8");
  const selectors = [...css.matchAll(/^\s*\.([A-Za-z0-9_-]+)/gm)].map((m) => m[1]);
  return [...new Set(selectors)];
}

let failures = 0;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  console.log(`--- ${file}`);

  // import alias from "<qualquer caminho>.module.css"
  const imports = [...source.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+\.module\.css)["']/g)]
    .map((m) => ({ alias: m[1], cssPath: resolveImport(path.dirname(path.resolve(file)), m[2]) }))
    .filter((entry) => entry.cssPath && fs.existsSync(entry.cssPath));

  if (imports.length === 0) {
    console.log("  (sem CSS module importado)");
    continue;
  }

  for (const { alias, cssPath } of imports) {
    const defined = topLevelClasses(cssPath);
    const used = [...new Set([...source.matchAll(new RegExp(`${alias}\\.([A-Za-z0-9_]+)`, "g"))].map((m) => m[1]))];
    const missing = used.filter((u) => !defined.includes(u));
    const unused = defined.filter((d) => !used.includes(d));

    console.log(`  ${alias} -> ${path.relative(ROOT, cssPath)} | usadas=${used.length} definidas=${defined.length}`);
    if (missing.length) {
      console.log(`    ERRO: classes usadas que NAO existem no CSS -> ${missing.join(", ")}`);
      failures++;
    }
    if (unused.length) {
      console.log(`    AVISO: classes definidas e nao usadas aqui -> ${unused.join(", ")}`);
    }
  }
}

console.log(failures ? `\nFALHAS: ${failures}` : "\nOK: nenhuma classe indefinida");
process.exit(failures ? 1 : 0);
