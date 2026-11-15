#!/usr/bin/env node
/**
 * Reconstrói o motivo de monetização já gravado em `games.content_rating_reasons`.
 *
 * ## Por que este script existe
 *
 * A correção em `models/content-rating.js` vale para **novos** cálculos. O que
 * já está no banco continua como foi gravado — inclusive os motivos com o
 * defeito que apareceu em produção:
 *
 *     Monetização (Lei Felca): classificação 10 — microtransações
 *
 * gravado para um jogo cuja resposta foi "apenas expansões ou DLCs". Reclassificar
 * cada jogo pela tela resolveria, mas depende de alguém refazer o questionário
 * inteiro para corrigir uma frase.
 *
 * ## O que dá para corrigir sem inventar
 *
 * - **Nome da norma**: "Lei Felca (PL 412/2022)" → "ECA Digital (Lei nº 15.211/2025)".
 * - **Unidade da faixa**: "classificação 10" → "classificação 10 anos".
 * - **Descrição**: sai das colunas de flag (`has_lootboxes`,
 *   `has_in_game_purchases`, `has_excessive_ads`), que existem na linha. Quando
 *   nenhuma está ligada, o texto vira "compras ou publicidade declaradas" — o
 *   banco não guarda *qual* opção foi escolhida (DLC? anúncio no menu?), então
 *   afirmar o detalhe seria adivinhar. O que **não** se mantém é
 *   "microtransações", que o formulário pode ter negado.
 *
 * Uso:
 *   node scripts/fix-monetization-reasons.js            # dry-run
 *   node scripts/fix-monetization-reasons.js --apply
 */
const fs = require("node:fs");
const path = require("node:path");

const APPLY = process.argv.includes("--apply");
const ENV_PATH = (process.argv.find((arg) => arg.startsWith("--envPath=")) || "").replace("--envPath=", "") || ".env.development";

loadEnv(ENV_PATH);

/** Carrega o `.env` sem depender do `dotenv` estar resolvido pelo Node. */
function loadEnv(file) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;

  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const MONETIZATION_PREFIX = "Monetização";

function buildDescription(flags) {
  const parts = [];
  if (flags.hasLootboxes) parts.push("lootboxes pagas");
  if (flags.hasInGamePurchases) parts.push("compras no jogo");
  if (flags.hasExcessiveAds) parts.push("anúncios excessivos");
  return parts.length > 0 ? parts.join(", ") : "compras ou publicidade declaradas";
}

function normalizeRatingLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // "10" → "10 anos"; "10 anos" permanece; "L" continua "L".
  if (/^\d+$/.test(raw)) return `${raw} anos`;
  return raw;
}

/**
 * Reescreve um motivo de monetização; devolve o texto novo (ou o mesmo, quando
 * não há o que corrigir).
 */
function fixReason(reason, flags) {
  if (!String(reason).startsWith(MONETIZATION_PREFIX)) return reason;

  const match = /^Monetização \(([^)]*)\):\s*classificação\s+([^—]+?)\s*—\s*(.*)$/.exec(reason);
  if (!match) return reason;

  const [, , ratingRaw, descriptionRaw] = match;
  const rating = normalizeRatingLabel(ratingRaw);
  const description = descriptionRaw.trim();
  // Só substitui a descrição quando ela é o fallback antigo — a frase que
  // afirmava "microtransações" sem o formulário ter dito isso.
  const finalDescription = description === "microtransações" ? buildDescription(flags) : description;

  return `Monetização (ECA Digital): classificação ${rating} — ${finalDescription}`;
}

async function main() {
  const { default: database } = await import("../infra/database.js");

  const result = await database.query({
    text: `SELECT id, slug, content_rating_reasons, has_lootboxes, has_in_game_purchases, has_excessive_ads
           FROM games
           WHERE content_rating_reasons LIKE '%Monetização%'
           ORDER BY slug`,
  });

  if (result.rowCount === 0) {
    console.log("Nenhum jogo com motivo de monetização gravado. Nada a fazer.");
    return;
  }

  let changed = 0;

  for (const row of result.rows) {
    let reasons;
    try {
      reasons = JSON.parse(row.content_rating_reasons);
    } catch {
      console.warn(`  ! ${row.slug}: content_rating_reasons não é JSON válido, pulando`);
      continue;
    }
    if (!Array.isArray(reasons)) continue;

    const flags = {
      hasLootboxes: row.has_lootboxes === true,
      hasInGamePurchases: row.has_in_game_purchases === true,
      hasExcessiveAds: row.has_excessive_ads === true,
    };

    const next = reasons.map((reason) => fixReason(reason, flags));
    const nextJson = JSON.stringify(next);
    if (nextJson === row.content_rating_reasons) continue;

    changed += 1;
    console.log(`--- ${row.slug}`);
    for (const [index, reason] of reasons.entries()) {
      if (reason === next[index]) continue;
      console.log(`  antes:  ${reason}`);
      console.log(`  depois: ${next[index]}`);
    }

    if (APPLY) {
      await database.query({
        text: `UPDATE games SET content_rating_reasons = $1 WHERE id = $2`,
        values: [nextJson, row.id],
      });
    }
  }

  console.log(`\n${result.rowCount} jogo(s) com monetização, ${changed} a corrigir.`);
  if (!APPLY) console.log("Nada foi gravado. Rode com --apply para aplicar.");
}

// Exportado para teste: `main()` só roda quando o script é executado direto.
module.exports = { fixReason, buildDescription, normalizeRatingLabel };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
