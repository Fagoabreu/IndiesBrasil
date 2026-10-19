/**
 * Valores de `notification_type` usados pelas curtidas e comentários em assets
 * (feed de notificações do estúdio).
 *
 * `ALTER TYPE ... ADD VALUE` não roda dentro de transação no PostgreSQL, por
 * isso `noTransaction` — o mesmo motivo de
 * `1788969600000_content-interaction-types.js`. Os títulos e mensagens são
 * resolvidos no cliente (`lib/notifications.js`), não em `notification_messages`.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_asset_liked';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_asset_commented';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_asset_reviewed';`);
};

// Valores de enum não podem ser removidos com segurança no PostgreSQL.
exports.down = () => {};
