/**
 * Copia o core do ffmpeg.wasm para `public/ffmpeg/`.
 *
 * ## Por que copiar e não empacotar
 *
 * O `ffmpeg-core.wasm` tem ~32 MB. Colocá-lo no bundle faria o Next processar
 * (e reescrever o hash de) um binário a cada build, e o arquivo precisa de uma
 * URL estável — é ela que `ffmpeg.load({ coreURL, wasmURL })` recebe e que o
 * `Cache-Control: immutable` de `next.config.js` guarda por um ano.
 *
 * ## Por que um script e não `postinstall`
 *
 * O `package.json` tem `allowScripts` com allowlist (`sharp`, `unrs-resolver`):
 * um `postinstall` que o gerenciador não executa deixa a ferramenta quebrada
 * **sem erro nenhum** — a página abre e a compressão responde 404 no `.wasm`.
 * Encadear em `dev`, `build` e `test` (que é onde o Next é servido) faz o
 * arquivo existir sempre que alguém sobe o projeto.
 *
 * ## Idempotente
 *
 * Compara tamanho e data de modificação; cópia desnecessária não acontece, o
 * que mantém o `npm run dev` rápido. Também "conserta" um arquivo truncado
 * (tamanho diferente = recopia).
 *
 * Uso: node scripts/sync-ffmpeg-core.js
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

/**
 * Os dois arquivos do core. O `.worker.js` só existe na build multithread.
 */
const CORE_FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

/**
 * O worker do `@ffmpeg/ffmpeg` e as duas dependências que ele importa.
 *
 * O pacote traz `new Worker(new URL("./worker.js", import.meta.url))`, e o
 * bundler do Next **copia esse arquivo sem empacotar os imports relativos**:
 * o `worker.js` emitido continua fazendo `import ... from "./const.js"`, que
 * aponta para um arquivo que não existe em `/_next/static/media/`. O worker
 * morre no primeiro `import` e a compressão falha com erro de rede — por isso
 * os três arquivos são servidos juntos em `public/ffmpeg/` e o `classWorkerURL`
 * aponta para lá. Como os três ficam no mesmo diretório, os imports relativos
 * passam a resolver sozinhos (nenhuma reescrita de caminho).
 */
const FFMPEG_FILES = ["worker.js", "const.js", "errors.js"];

const SOURCE_DIR = path.join(ROOT, "node_modules", "@ffmpeg", "core", "dist", "esm");
const WORKER_SOURCE_DIR = path.join(ROOT, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const TARGET_DIR = path.join(ROOT, "public", "ffmpeg");

/** Lista única de origem → arquivos, para o laço de cópia não ter dois formatos. */
const SOURCES = [
  { dir: SOURCE_DIR, files: CORE_FILES, label: "Core do ffmpeg" },
  { dir: WORKER_SOURCE_DIR, files: FFMPEG_FILES, label: "Worker do @ffmpeg/ffmpeg" },
];

function shouldCopy(source, target) {
  if (!fs.existsSync(target)) return true;

  const sourceStat = fs.statSync(source);
  const targetStat = fs.statSync(target);

  return sourceStat.size !== targetStat.size || sourceStat.mtimeMs > targetStat.mtimeMs;
}

function main() {
  // Falha alto: seguir sem os arquivos gera uma página que abre e falha só no
  // clique de "Comprimir", que é o pior lugar para descobrir.
  for (const { dir, label } of SOURCES) {
    if (!fs.existsSync(dir)) {
      throw new Error(`${label} não encontrado em ${path.relative(ROOT, dir)}. Rode "npm ci" antes de subir o projeto.`);
    }
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });

  let copied = 0;

  for (const { dir, files } of SOURCES) {
    for (const name of files) {
      const source = path.join(dir, name);
      const target = path.join(TARGET_DIR, name);

      if (!fs.existsSync(source)) {
        throw new Error(`Arquivo ausente na instalação: ${path.relative(ROOT, source)}.`);
      }

      if (!shouldCopy(source, target)) {
        console.log(`ffmpeg: ${name} já está atualizado.`);
        continue;
      }

      fs.copyFileSync(source, target);
      copied += 1;
      const megabytes = (fs.statSync(target).size / (1024 * 1024)).toFixed(1);
      console.log(`ffmpeg: ${name} copiado (${megabytes} MB).`);
    }
  }

  console.log(copied ? `ffmpeg pronto em public/ffmpeg (${copied} arquivo[s]).` : "ffmpeg pronto (nada a copiar).");
}

try {
  main();
} catch (error) {
  console.error(`ERRO: ${error.message}`);
  process.exit(1);
}
