/**
 * Backfill dos contatos já cadastrados.
 *
 * ## O que ele faz
 *
 * Percorre `users_contacts` e `organization_contacts`, aplica
 * `normalizeContactValue` (o mesmo módulo que a API usa na escrita) e grava o
 * valor canônico quando ele muda.
 *
 * ## Por que é opcional
 *
 * O registro de contatos foi desenhado para que **URL absoluta passe intacta**
 * (ver `lib/contactTypes.js`, seção "O contrato que torna a mudança segura").
 * Todo contato antigo continua funcionando e já aparece com handle na tela; o
 * que este script acrescenta é que, ao abrir um contato para editar, o campo
 * mostre a forma canônica em vez do que foi digitado.
 *
 * Ou seja: rodar é melhoria, não correção. Pode ser adiado ou interrompido a
 * qualquer momento sem deixar o sistema em estado inconsistente — cada linha é
 * atualizada de forma independente e idempotente.
 *
 * ## Segurança
 *
 * - `--dry-run` mostra o que mudaria, sem escrever nada. **Rode assim primeiro.**
 * - Valores que o tipo recusa (um telefone inválido, por exemplo) são
 *   **preservados e listados**, nunca apagados: o dado é do usuário, e a tela
 *   continua exibindo o que está lá.
 * - Nunca inventa valor: se a normalização não produz nada, não toca na linha.
 *
 * Uso:
 *   node scripts/normalize-contacts.js --dry-run
 *   node scripts/normalize-contacts.js
 */
require("dotenv").config({ path: ".env.development" });

/** As duas tabelas de contato, com a coluna que liga cada uma ao dono. */
const TABLES = [
  { table: "users_contacts", ownerColumn: "user_id" },
  { table: "organization_contacts", ownerColumn: "org_id" },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // `import()` dinâmico porque estes módulos são ESM e este script é CommonJS
  // (o package.json não declara `"type": "module"`).
  const { default: database } = await import("../infra/database.js");
  const { normalizeContactValue, getContactLabel } = await import("../lib/contactTypes.js");

  console.log(dryRun ? "Modo --dry-run: nada será gravado.\n" : "Aplicando a normalização.\n");

  let totalChanged = 0;
  let totalSkipped = 0;
  let totalUnchanged = 0;

  for (const { table, ownerColumn } of TABLES) {
    // `table` e `ownerColumn` são interpolados, e não parametrizados: o Postgres
    // não aceita identificador como parâmetro. Os dois valores vêm da constante
    // TABLES, acima — nenhum trecho desta query vem de entrada externa.
    const rows = await database.query({
      text: `
        SELECT
          c.id,
          c.contact_value,
          c.${ownerColumn} AS owner_id,
          ct.icon_key
        FROM ${table} c
        JOIN contact_type ct ON ct.id = c.contact_type_id
        ORDER BY c.id`,
    });

    console.log(`── ${table}: ${rows.rowCount} contato(s)`);

    const skipped = [];

    for (const row of rows.rows) {
      const result = normalizeContactValue(row.icon_key, row.contact_value);

      if (!result.ok) {
        // Valor que o tipo recusa. Pode ser um telefone digitado errado ou um
        // contato criado quando não havia validação — em nenhum caso é nosso
        // papel apagar.
        skipped.push({ id: row.id, label: getContactLabel(row.icon_key), value: row.contact_value, reason: result.reason });
        continue;
      }

      if (result.value === row.contact_value) {
        totalUnchanged += 1;
        continue;
      }

      totalChanged += 1;
      console.log(`  #${row.id} ${getContactLabel(row.icon_key)}`);
      console.log(`      antes: ${row.contact_value}`);
      console.log(`      depois: ${result.value}`);

      if (!dryRun) {
        await database.query({
          text: `UPDATE ${table} SET contact_value = $1 WHERE id = $2`,
          values: [result.value, row.id],
        });
      }
    }

    if (skipped.length) {
      totalSkipped += skipped.length;
      console.log(`\n  ${skipped.length} valor(es) preservado(s) — o tipo não aceita o formato:`);
      for (const item of skipped) {
        console.log(`      #${item.id} ${item.label}: ${item.value}`);
        console.log(`         ${item.reason}`);
      }
    }
    console.log("");
  }

  console.log(`Alterados: ${totalChanged}   Já normalizados: ${totalUnchanged}   Preservados: ${totalSkipped}`);
  if (dryRun && totalChanged > 0) {
    console.log("\nRode sem --dry-run para aplicar.");
  }
}

main().catch((error) => {
  console.error("Falha no backfill:", error.message);
  process.exit(1);
});
