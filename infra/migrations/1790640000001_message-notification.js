/**
 * Adiciona o tipo de notificação de mensagem direta.
 *
 * `noTransaction: true` porque o PostgreSQL exige que o novo valor do enum seja
 * commitado antes de ser usado — mesmo motivo das migrations irmãs
 * (meeting-scheduled-notification, studio-notification-types).
 *
 * Título e mensagem são resolvidos no cliente, via lib/notifications.js.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';`);
};

// Valores de enum não podem ser removidos com segurança no PostgreSQL.
exports.down = () => {};
