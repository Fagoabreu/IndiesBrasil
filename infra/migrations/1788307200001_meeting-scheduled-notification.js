/**
 * Passo 1/2 — Adiciona 'meeting_scheduled' ao enum notification_type e
 * estende user_notifications com a coluna meeting_code.
 *
 * A mensagem/título são definidos no cliente (CLIENT_NOTIF_DEFS em
 * NotificationButton.js e no perfil), no mesmo padrão de 'studio_invitation'
 * (migration 1779580800002/1779580800003) — nenhum INSERT em
 * notification_messages é feito aqui.
 *
 * A PK passa a incluir meeting_code para permitir UMA notificação por
 * reunião/membro (ON CONFLICT). Linhas existentes permanecem únicas porque
 * a coluna nova usa DEFAULT '' sobre uma 4-tupla que já era PK.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_scheduled';`);

  pgm.sql(`
    ALTER TABLE user_notifications
      ADD COLUMN IF NOT EXISTS meeting_code varchar(16) NOT NULL DEFAULT '';

    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_pkey;

    ALTER TABLE user_notifications
      ADD PRIMARY KEY (user_id, type, source_user_id, org_slug, meeting_code);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_pkey;

    -- Remove a coluna meeting_code e deduplica: cada tupla
    -- (user_id, type, source_user_id, org_slug) deve sobrar uma única vez
    -- para a PK antiga poder ser recriada.
    DELETE FROM user_notifications a
      USING user_notifications b
      WHERE a.ctid < b.ctid
        AND a.user_id = b.user_id
        AND a.type = b.type
        AND a.source_user_id = b.source_user_id
        AND a.org_slug = b.org_slug;

    ALTER TABLE user_notifications DROP COLUMN IF EXISTS meeting_code;
    ALTER TABLE user_notifications ADD PRIMARY KEY (user_id, type, source_user_id, org_slug);
  `);
  // Nota: valores de enum não podem ser removidos no PostgreSQL.
};
