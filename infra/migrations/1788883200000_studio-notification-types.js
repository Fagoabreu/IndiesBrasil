/**
 * Adiciona os valores de notification_type usados pelas notificações do
 * estúdio (feed compartilhado entre membros).
 *
 * Por limitação de snapshot do PostgreSQL, os títulos/mensagens dessas
 * notificações são resolvidos no cliente via lib/notifications.js.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_post_liked';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_post_commented';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_game_reviewed';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_boardgame_reviewed';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_book_reviewed';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_order_received';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_order_updated';`);
};

// Valores de enum não podem ser removidos com segurança no PostgreSQL.
exports.down = () => {};
