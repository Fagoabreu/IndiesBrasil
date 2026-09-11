/**
 * Adiciona os valores de notification_type usados pelas curtidas/comentários
 * em jogos, jogos de mesa e livros (feed compartilhado do estúdio).
 *
 * Por limitação de snapshot do PostgreSQL, os títulos/mensagens dessas
 * notificações são resolvidos no cliente via lib/notifications.js.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_game_liked';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_game_commented';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_boardgame_liked';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_boardgame_commented';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_book_liked';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_book_commented';`);
};

// Valores de enum não podem ser removidos com segurança no PostgreSQL.
exports.down = () => {};
