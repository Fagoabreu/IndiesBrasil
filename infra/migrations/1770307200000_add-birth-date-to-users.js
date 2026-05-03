exports.up = (pgm) => {
  pgm.addColumn("users", {
    birth_date: {
      type: "date",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("users", "birth_date");
};
