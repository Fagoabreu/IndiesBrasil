/**
 * Migration: boardgame_media
 *
 * Creates the boardgame_media table for storing screenshots and video URLs
 * associated with a board game.
 */

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("boardgame_media", {
    id: { type: "serial", primaryKey: true },
    boardgame_id: {
      type: "uuid",
      notNull: true,
      references: "boardgames(id)",
      onDelete: "CASCADE",
    },
    media_type: { type: "varchar(10)", notNull: true }, // 'image' | 'video'
    url: { type: "varchar(512)", notNull: true },
    caption: { type: "varchar(255)" },
    display_order: { type: "integer", notNull: true, default: 0 },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("boardgame_media", "boardgame_id");
};

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("boardgame_media", { cascade: true });
};
