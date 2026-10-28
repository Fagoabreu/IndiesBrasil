/**
 * Conserta a ORDEM de `pgmigrations` quando ela deixa de ser a ordem dos
 * arquivos — sem tocar em schema nem em dado.
 *
 * ## O erro que isto resolve
 *
 * ```
 * Error: Not run migration 1779580800003_studio-invitation-notification-message
 *        is preceding already run migration 1779840000001_games-user-features
 * ```
 *
 * `node-pg-migrate` confere a ordem por **posição**: lê `pgmigrations`
 * ordenada por `run_on, id` e compara, índice por índice, com os arquivos
 * ordenados pelo carimbo do nome (`checkOrder` no bundle da lib). Se as duas
 * listas têm os mesmos nomes mas em ordens diferentes, o erro aparece mesmo
 * **sem faltar migration nenhuma** — e `up` passa a falhar para sempre, porque
 * a checagem roda antes de qualquer coisa.
 *
 * Foi o que aconteceu: quatro migrations (`1779580800003`, `…004`, `…005` e
 * `1779840000000_create-games`) foram registradas **depois** das seguintes. O
 * banco está completo (o `--no-check-order` responde "No migrations to run!"),
 * só o `run_on` dessas linhas está fora de sequência.
 *
 * ## O que ele faz
 *
 * Percorre os arquivos em ordem e garante que o `run_on` de cada linha seja
 * **estritamente crescente**. Linha que já está no lugar não é tocada; a que
 * está fora recebe `run_on = (anterior) + 1 ms` — o mínimo para caber no vão,
 * preservando a data real das outras. Só o `run_on` muda: nada de schema, nada
 * de dado de aplicação.
 *
 * ## Por que não usar `--no-check-order`
 *
 * Porque isso desliga a checagem em vez de corrigir o estado. A próxima
 * migration de verdade continuaria entrando no fim, e a divergência entre
 * arquivo e banco ficaria invisível até alguém precisar de `down`.
 *
 * ## Segurança
 *
 * - `--dry-run` mostra o que mudaria, sem escrever. **Rode assim primeiro.**
 * - Recusa quando falta arquivo na tabela (aí o problema é outro: há migration
 *   pendente e o caminho é aplicar, não reordenar) ou quando sobra linha sem
 *   arquivo (migration excluída — precisa de decisão humana).
 * - Tudo em uma transação: ou todas as linhas são reordenadas, ou nenhuma.
 *
 * Uso:
 *   node scripts/repair-migration-order.js --dry-run
 *   node scripts/repair-migration-order.js
 *   node scripts/repair-migration-order.js --envPath=.env.production
 */
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "infra", "migrations");

/** Milissegundo de folga entre duas linhas reordenadas (timestamptz tem µs). */
const STEP_SECONDS = 0.001;

/**
 * Plano de reparo — puro, para poder ser testado sem banco.
 *
 * A ideia é mover o **mínimo** de linhas: fica tudo que já está em ordem
 * crescente (a maior subsequência crescente — LIS) e só as linhas fora dela
 * recebem `run_on` novo, encaixadas no vão entre as vizinhas que ficaram.
 * Reordenar "empurrando todo mundo" (a partir do primeiro fora de ordem)
 * reescreveria ~67 linhas em vez de 4 e apagaria a data real de cada uma.
 *
 * @param {{ files: string[], rows: Array<{ id: number, name: string, epoch: number }> }} input
 *   `files` na ordem dos arquivos (carimbo do nome, crescente) e `rows` na ordem
 *   em que o `node-pg-migrate` as lê (`ORDER BY run_on, id`).
 * @returns {{
 *   ok: boolean,
 *   missing: string[],
 *   extra: string[],
 *   changes: Array<{ id: number, name: string, fromEpoch: number, toEpoch: number }>,
 * }}
 */
function planRepair({ files, rows }) {
  const applied = new Map(rows.map((row) => [row.name, row]));
  const fileSet = new Set(files);

  const missing = files.filter((name) => !applied.has(name));
  const extra = rows.filter((row) => !fileSet.has(row.name)).map((row) => row.name);

  if (missing.length > 0 || extra.length > 0) {
    return { ok: false, missing, extra, changes: [] };
  }

  // Sequência na ordem dos arquivos: o que já é crescente fica como está.
  const sequence = files.map((name) => ({ name, row: applied.get(name), epoch: Number(applied.get(name).epoch) }));
  const keep = longestIncreasingIndexes(sequence.map((item) => item.epoch));
  const keepSet = new Set(keep);

  const changes = [];

  let index = 0;
  while (index < sequence.length) {
    if (keepSet.has(index)) {
      index += 1;
      continue;
    }

    // Bloco contíguo de linhas fora de ordem, entre duas linhas que ficaram.
    const start = index;
    while (index < sequence.length && !keepSet.has(index)) index += 1;
    const block = sequence.slice(start, index);

    const lower = start > 0 ? sequence[start - 1].epoch : null;
    const upper = index < sequence.length ? sequence[index].epoch : null;

    block.forEach((item, position) => {
      const toEpoch = slotBetween({ lower, upper, position, count: block.length });
      changes.push({ id: item.row.id, name: item.name, fromEpoch: item.epoch, toEpoch });
    });
  }

  return { ok: true, missing, extra, changes };
}

/** Índices da maior subsequência estritamente crescente (O(n²), n = migrations). */
function longestIncreasingIndexes(values) {
  const length = values.map(() => 1);
  const previous = values.map(() => -1);

  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (values[j] < values[i] && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1;
        previous[i] = j;
      }
    }
  }

  let best = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (length[i] > length[best]) best = i;
  }

  const indexes = [];
  for (let cursor = best; cursor >= 0; cursor = previous[cursor]) indexes.unshift(cursor);
  return indexes;
}

/**
 * Encaixa a `position`-ésima linha de um bloco entre `lower` e `upper`.
 *
 * Com espaço confortável, cada linha anda 1 ms a partir da anterior. Com vão
 * apertado (várias linhas no mesmo intervalo), distribui proporcionalmente —
 * nunca encosta nas vizinhas, que é o que o `checkOrder` exige.
 */
function slotBetween({ lower, upper, position, count }) {
  if (lower === null && upper === null) return position * STEP_SECONDS;
  if (lower === null) return upper - STEP_SECONDS * (count - position);
  if (upper === null) return lower + STEP_SECONDS * (position + 1);

  const available = upper - lower;
  if (available > STEP_SECONDS * (count + 1)) {
    return lower + STEP_SECONDS * (position + 1);
  }

  return lower + (available * (position + 1)) / (count + 1);
}

/** Carimbo do começo do nome (`1779580800003_nome.js` → 1779580800003). */
function timestampOf(fileName) {
  const match = /^(\d+)[-_]/.exec(fileName);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function readMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".js"))
    // `pgmigrations.name` guarda o nome **sem** a extensão (é assim que o
    // node-pg-migrate monta o nome da migration a partir do arquivo).
    .map((name) => name.slice(0, -".js".length))
    .sort((a, b) => timestampOf(a) - timestampOf(b) || a.localeCompare(b));
}

function formatEpoch(epoch) {
  return new Date(epoch * 1000).toISOString();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const envArg = process.argv.find((arg) => arg.startsWith("--envPath="));
  const envPath = envArg ? envArg.slice("--envPath=".length) : ".env.development";

  require("dotenv").config({ path: envPath });

  // `import()` dinâmico porque `infra/database.js` é ESM e este script é
  // CommonJS (o package.json não declara `"type": "module"`). Usar o mesmo
  // módulo do app garante a mesma resolução de env e o mesmo SSL de produção.
  const { default: database } = await import("../infra/database.js");

  console.log(`Banco: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`);
  console.log(dryRun ? "Modo --dry-run: nada será gravado.\n" : "Reordenando.\n");

  const files = readMigrationFiles();

  // Mesma ordenação de `getRunMigrations` (node-pg-migrate): `run_on, id`.
  // `epoch` vem do banco com microssegundos — comparar `Date` perderia a
  // diferença entre linhas gravadas no mesmo milissegundo.
  const result = await database.query({
    text: `SELECT id, name, EXTRACT(EPOCH FROM run_on) AS epoch FROM pgmigrations ORDER BY run_on, id`,
  });

  const rows = result.rows.map((row) => ({ id: row.id, name: row.name, epoch: Number(row.epoch) }));
  const plan = planRepair({ files, rows });

  if (!plan.ok) {
    if (plan.missing.length > 0) {
      console.error(`Há migration(ns) pendente(s) — ${plan.missing.length}:`);
      for (const name of plan.missing) console.error(`  - ${name}`);
      console.error("\nReordenar não resolve: é preciso aplicar. Rode `npm run migrations:up` depois de");
      console.error("entender por que elas não rodaram (o erro de ordem esconde a verdadeira causa).");
    }
    if (plan.extra.length > 0) {
      console.error(`Há linha(s) em pgmigrations sem arquivo correspondente — ${plan.extra.length}:`);
      for (const name of plan.extra) console.error(`  - ${name}`);
      console.error("\nMigration excluída do repositório precisa de decisão humana: o arquivo foi");
      console.error("apagado por engano, ou a linha é lixo de uma execução antiga?");
    }
    process.exitCode = 1;
    return;
  }

  if (plan.changes.length === 0) {
    console.log("Ordem já está correta — nada a fazer.");
    return;
  }

  console.log(`${plan.changes.length} linha(s) fora de ordem:`);
  for (const change of plan.changes) {
    console.log(`  #${change.id} ${change.name}`);
    console.log(`      antes:  ${formatEpoch(change.fromEpoch)}`);
    console.log(`      depois: ${formatEpoch(change.toEpoch)}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado. Rode sem a flag para aplicar.");
    return;
  }

  await database.transaction(async (client) => {
    for (const change of plan.changes) {
      await client.query({
        text: `UPDATE pgmigrations SET run_on = to_timestamp($1) WHERE id = $2`,
        values: [change.toEpoch, change.id],
      });
    }
  });

  console.log(`\n${plan.changes.length} linha(s) reordenada(s). Confira com: npm run migrations:up`);
}

module.exports = { planRepair };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
