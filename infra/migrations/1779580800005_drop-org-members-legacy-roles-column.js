/**
 * Remove a coluna legada "Roles" (com R maiúsculo, criada com identificador
 * entreaspas) da tabela org_members.
 *
 * Contexto: a migration organizations-v2 tentou `dropColumn("org_members", "roles")`
 * em minúsculo, mas o PostgreSQL trata identificadores entreaspas de forma
 * case-sensitive — a coluna era "Roles" e nunca foi removida. Ela ficou com NOT NULL
 * sem DEFAULT, bloqueando qualquer INSERT que não fornecesse esse campo (ex: aceitar
 * convite de estúdio). Os roles dos membros são gerenciados pela tabela `org_roles`;
 * esta coluna é inteiramente redundante.
 */

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE org_members DROP COLUMN IF EXISTS "Roles"`);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE org_members
      ADD COLUMN IF NOT EXISTS "Roles" org_role[] NOT NULL DEFAULT '{}'
  `);
};
