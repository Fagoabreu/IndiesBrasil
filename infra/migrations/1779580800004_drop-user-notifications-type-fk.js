/**
 * Remove a FK de user_notifications.type → notification_messages(type).
 *
 * Motivação: tipos de notificação adicionados via ALTER TYPE ADD VALUE não podem
 * ser inseridos em notification_messages na mesma sessão de banco (limitação de
 * snapshot do PostgreSQL), impedindo a criação de notificações do tipo
 * 'studio_invitation'. Com a FK removida, user_notifications pode ter qualquer
 * valor válido do enum sem exigir uma linha correspondente em notification_messages.
 * O título e a mensagem de tipos sem linha na tabela são resolvidos pelo cliente
 * via CLIENT_NOTIF_DEFS (NotificationButton.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_notifications
      DROP CONSTRAINT IF EXISTS user_notifications_type_fkey;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_fkey
      FOREIGN KEY (type) REFERENCES notification_messages(type) ON DELETE CASCADE;
  `);
};
