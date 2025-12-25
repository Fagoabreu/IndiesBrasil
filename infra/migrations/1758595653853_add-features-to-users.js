exports.up = (pgm) => {
  pgm.addColumn("users", {
    features: {
      type: "varchar(64)[]",
      notNull: true,
      default: "{}",
    },
  });
};

exports.down = false;
