/**
 * Passo 1/2 — Adiciona 'studio_invitation' ao enum notification_type e
 * estende user_notifications com a coluna org_slug.
 *
 * O INSERT em notification_messages precisa ficar em uma migration separada
 * pois o PostgreSQL exige que o novo valor do enum seja commitado antes de ser usado.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(
    `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'studio_invitation';`,
  );

  pgm.sql(`
    ALTER TABLE user_notifications
      ADD COLUMN IF NOT EXISTS org_slug varchar(128) NOT NULL DEFAULT '';

    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_pkey;

    ALTER TABLE user_notifications
      ADD PRIMARY KEY (user_id, type, source_user_id, org_slug);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_pkey;
    ALTER TABLE user_notifications DROP COLUMN IF EXISTS org_slug;
    ALTER TABLE user_notifications ADD PRIMARY KEY (user_id, type, source_user_id);
  `);
  // Nota: valores de enum não podem ser removidos no PostgreSQL.
};
