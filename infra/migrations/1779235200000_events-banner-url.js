/** @type {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  pgm.addColumn("events", {
    banner_external_url: {
      type: "VARCHAR(512)",
      notNull: false,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn("events", "banner_external_url");
};
