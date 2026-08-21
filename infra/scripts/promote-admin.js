/**
 * Promove um usuário existente a administrador.
 *
 * Um admin é um usuário que possui a feature `read:admin` no array `features`
 * (coluna `features varchar(64)[]` da tabela `users`). Não existe uma tabela
 * de "roles" em uso para permissões — a autorização é feita por features.
 *
 * O script é idempotente: se o usuário já possui `read:admin`, nada é alterado.
 *
 * Uso:
 *   node infra/scripts/promote-admin.js <username|email> [--env <arquivo.env>]
 *
 * Exemplos:
 *   node infra/scripts/promote-admin.js fabio
 *   node infra/scripts/promote-admin.js fabio@indiesbrasil.com --env .env.development
 *
 * A conexão segue a mesma lógica de SSL de `infra/database.js`:
 *   - produção com POSTGRES_CA_PATH  -> CA explícita (rejectUnauthorized: true)
 *   - produção sem POSTGRES_CA_PATH  -> self-signed (rejectUnauthorized: false)
 *   - dev/teste                      -> sem SSL
 */

const fs = require("fs");

// ─── Argumentos de linha de comando ──────────────────────────────────────────
const args = process.argv.slice(2);
const identifier = args.find((arg) => !arg.startsWith("--"));
const envFlagIndex = args.indexOf("--env");
const envFile = envFlagIndex !== -1 ? args[envFlagIndex + 1] : ".env.development";

if (!identifier || (envFlagIndex !== -1 && !envFile)) {
  console.error("Uso: node infra/scripts/promote-admin.js <username|email> [--env <arquivo.env>]");
  process.exit(1);
}

require("dotenv").config({ path: envFile });
const { Client } = require("pg");

function getSSLValues() {
  if (process.env.NODE_ENV === "production" && process.env.POSTGRES_CA_PATH) {
    return {
      ca: fs.readFileSync(process.env.POSTGRES_CA_PATH),
      rejectUnauthorized: true,
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      rejectUnauthorized: false,
    };
  }

  return false;
}

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: getSSLValues(),
  });

  await client.connect();

  try {
    // Localiza o usuário por username (prioridade) ou email, case-insensitive.
    const found = await client.query(
      `
        SELECT id, username, email, features
        FROM users
        WHERE LOWER(username) = LOWER($1)
           OR LOWER(email) = LOWER($1)
        ORDER BY (LOWER(username) = LOWER($1)) DESC
        LIMIT 1
      `,
      [identifier],
    );

    if (found.rowCount === 0) {
      console.error(`❌ Usuário "${identifier}" não encontrado.`);
      process.exitCode = 1;
      return;
    }

    const userRow = found.rows[0];
    const features = userRow.features || [];

    if (features.includes("read:admin")) {
      console.log(`ℹ️  Usuário @${userRow.username} já é administrador.`);
      return;
    }

    await client.query(
      `
        UPDATE users
        SET features = array_append(features, 'read:admin'),
            updated_at = now()
        WHERE id = $1
      `,
      [userRow.id],
    );

    console.log(`✅ Usuário @${userRow.username} (${userRow.email}) promovido a administrador.`);
    console.log("   Feature concedida: read:admin");
    console.log("   Faça login novamente (ou recarregue a página) para ver o menu Admin.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Erro ao promover usuário:", error.message);
  process.exit(1);
});
