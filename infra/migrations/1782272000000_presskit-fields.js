/**
 * Adiciona website e features à tabela organizations para o press kit.
 */
exports.up = (pgm) => {
  pgm.addColumns("organizations", {
    website: { type: "varchar(512)", notNull: false },
    features: { type: "text", notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE organizations
    DROP COLUMN IF EXISTS website,
    DROP COLUMN IF EXISTS features;
  `);
};
