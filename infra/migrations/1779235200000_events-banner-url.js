/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn("events", {
    banner_external_url: {
      type: "VARCHAR(512)",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("events", "banner_external_url");
};
