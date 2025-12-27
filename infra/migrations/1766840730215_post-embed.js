exports.up = (pgm) => {
  pgm.addColumn("posts", {
    embed: {
      type: "jsonb[]",
      notNull: false,
    },
  });
};

exports.down = false;
