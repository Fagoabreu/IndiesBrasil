/**
 * Auditoria do fork vendorizado do Galene (`galene/`).
 *
 * O subprojeto é o upstream na tag fixada + as nossas customizações, editadas
 * direto na árvore. Não há arquivos de patch, então a única garantia de que
 * ninguém divergiu por acidente é comparar com a tag oficial.
 *
 * Divergência acidental é silenciosa e cara: foi assim que o repositório passou
 * a vendorizar a 1.2.1 enquanto o Dockerfile construía a imagem a partir da
 * 1.1 — o que estava versionado não era o que rodava. Uma edição no diretório
 * errado, ou um arquivo salvo em CRLF no Windows, produz o mesmo efeito.
 *
 * O que o script faz:
 *   1. obtém a árvore da tag em galene/UPSTREAM.md (baixa, ou usa --from);
 *   2. compara arquivo a arquivo, byte a byte, com galene/;
 *   3. exige que a divergência seja EXATAMENTE o conjunto documentado em
 *      galene/UPSTREAM.md (adições nossas + arquivos do upstream modificados).
 *
 * Códigos de saída:
 *   0  árvore fiel ao upstream + customizações esperadas
 *   1  divergência detectada (o motivo é impresso)
 *   2  não foi possível verificar (sem rede/tar) — NÃO trate como sucesso
 *
 * Uso:
 *   node scripts/audit-galene-upstream.js
 *   node scripts/audit-galene-upstream.js --from /tmp/galene-galene-1.2.2
 *   node scripts/audit-galene-upstream.js --list
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = process.cwd();
const GALENE_DIR = path.join(ROOT, "galene");
const UPSTREAM_MD = path.join(GALENE_DIR, "UPSTREAM.md");

/** Arquivos que só existem aqui (não vêm do upstream). */
const EXPECTED_ADDED = new Set([
  ".dockerignore",
  ".gitattributes",
  "CUSTOMIZATIONS.md",
  "Dockerfile",
  "UPSTREAM.md",
  "groups/.gitkeep",
  "static/indies.css",
  "templates/config.example.json",
  "templates/group.example.json",
]);

/** Arquivos do upstream que nós modificamos de propósito. */
const EXPECTED_MODIFIED = new Set(["static/galene.js", "static/galene.html", "README.md"]);

/** Runtime: os grupos nascem aqui em execução; não entram na comparação. */
const RUNTIME_IGNORES = [/^groups\/.+\.json$/, /\.tmp$/, /^data\//];

function ignore(rel) {
  return RUNTIME_IGNORES.some((re) => re.test(rel));
}

/**
 * A tag é lida do `galene/UPSTREAM.md` (tabela "Versão base") para não existir
 * uma segunda cópia que possa divergir da documentação.
 */
function readBaseTag() {
  const md = fs.readFileSync(UPSTREAM_MD, "utf8");
  const match = md.match(/\|\s*Tag base\s*\|\s*`([^`]+)`\s*\|/);
  if (!match) {
    throw new Error(`não achei a "Tag base" na tabela de ${path.relative(ROOT, UPSTREAM_MD)}`);
  }
  return match[1];
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      walk(full, base, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

/** Baixa a tag (fetch nativo do Node) e extrai, devolvendo a árvore do upstream. */
async function fetchUpstream(tag, workDir) {
  const tarball = `${tag}.tar.gz`;
  const url = `https://github.com/jech/galene/archive/refs/tags/${tag}.tar.gz`;

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`download falhou: HTTP ${response.status} em ${url}`);
  }
  fs.writeFileSync(path.join(workDir, tarball), Buffer.from(await response.arrayBuffer()));

  // `cwd` + nome de arquivo relativo de propósito: no Git Bash (MSYS) o `tar`
  // do sistema interpreta um argumento contendo "C:" como host remoto e falha
  // com "Cannot connect to C:". Sem caminho absoluto em nenhum argumento, o
  // mesmo comando serve para MSYS, Linux e o bsdtar do Windows.
  const tar = spawnSync("tar", ["-xzf", tarball], { cwd: workDir, encoding: "utf8" });
  if (tar.error || tar.status !== 0) {
    throw new Error(`tar falhou: ${tar.error?.message || tar.stderr || `status ${tar.status}`}`);
  }

  // O diretório extraído é `<repo>-<tag>`, mas descobrimos qual é em vez de
  // montar o nome: assim uma mudança de nomeação no GitHub não engana o script.
  const extracted = fs
    .readdirSync(workDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(workDir, entry.name, "galene.go")))
    .map((entry) => path.join(workDir, entry.name));

  if (extracted.length !== 1) {
    throw new Error(`esperava 1 árvore do Galene em ${workDir}, achei ${extracted.length}`);
  }
  return extracted[0];
}

async function resolveUpstream(args) {
  const fromIndex = args.indexOf("--from");

  if (fromIndex !== -1) {
    const dir = path.resolve(args[fromIndex + 1] || "");
    if (!fs.existsSync(path.join(dir, "galene.go"))) {
      console.error(`✖ --from não aponta para a árvore do Galene: ${dir}`);
      process.exit(1);
    }
    return dir;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "galene-audit-"));
  try {
    return await fetchUpstream(readBaseTag(), workDir);
  } catch (error) {
    console.error(`✖ não foi possível obter o upstream: ${error.message}`);
    console.error("  sem rede? rode com --from <árvore já extraída>");
    process.exit(2);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const tag = readBaseTag();
  const upstream = await resolveUpstream(args);

  const theirs = new Set(walk(upstream).filter((rel) => !ignore(rel)));
  const ours = new Set(walk(GALENE_DIR).filter((rel) => !ignore(rel)));

  const added = [];
  const changed = [];
  const missing = [];
  const problems = [];

  for (const rel of [...ours].sort()) {
    if (!theirs.has(rel)) {
      added.push(rel);
      if (!EXPECTED_ADDED.has(rel)) {
        problems.push(`adição inesperada: ${rel} (não está em "Adições nossas" no UPSTREAM.md)`);
      }
      continue;
    }

    const upstreamBytes = fs.readFileSync(path.join(upstream, rel));
    const ourBytes = fs.readFileSync(path.join(GALENE_DIR, rel));
    if (!upstreamBytes.equals(ourBytes)) {
      changed.push(rel);
      if (!EXPECTED_MODIFIED.has(rel)) {
        problems.push(`alteração inesperada: ${rel} difere da tag ${tag} e não está em ` + '"Arquivos do upstream que modificamos" no UPSTREAM.md');
      }
    }
  }

  for (const rel of [...theirs].sort()) {
    if (!ours.has(rel)) {
      missing.push(rel);
      problems.push(`arquivo do upstream removido: ${rel}`);
    }
  }

  // Uma customização documentada que não diverge mais foi perdida num rebase.
  for (const rel of EXPECTED_MODIFIED) {
    if (theirs.has(rel) && !changed.includes(rel)) {
      problems.push(`customização PERDIDA: ${rel} está idêntico à tag ${tag}; confira CUSTOMIZATIONS.md`);
    }
  }

  for (const rel of EXPECTED_ADDED) {
    if (!ours.has(rel)) problems.push(`arquivo nosso sumiu: ${rel}`);
  }

  console.log(`Tag base: ${tag}  (lida de galene/UPSTREAM.md)`);
  console.log(`  arquivos nossos ......... ${ours.size}`);
  console.log(`  arquivos do upstream .... ${theirs.size}`);
  console.log(`  adições nossas .......... ${added.length}/${EXPECTED_ADDED.size}`);
  console.log(`  modificados por nós ..... ${changed.length}/${EXPECTED_MODIFIED.size}`);

  if (args.includes("--list")) {
    console.log("\nadições:");
    for (const rel of added) console.log(`  + ${rel}`);
    console.log("modificados:");
    for (const rel of changed) console.log(`  ~ ${rel}`);
    if (missing.length) {
      console.log("removidos:");
      for (const rel of missing) console.log(`  - ${rel}`);
    }
  }

  if (problems.length) {
    console.error("\n✖ divergência em relação ao documentado em galene/UPSTREAM.md:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nSe a mudança é intencional: atualize as tabelas de galene/UPSTREAM.md\n" +
        "e, tratando-se de customização do cliente, descreva a intenção em\n" +
        "galene/CUSTOMIZATIONS.md.",
    );
    process.exit(1);
  }

  console.log(`\nOK: árvore = upstream ${tag} + customizações documentadas`);
}

main().catch((error) => {
  console.error(`✖ falha inesperada na auditoria: ${error.message}`);
  process.exit(2);
});
