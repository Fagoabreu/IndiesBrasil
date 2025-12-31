exports.up = (pgm) => {
  pgm.addColumn("post_likes", {
    created_at: {
      type: "timestamptz",
      default: pgm.func("timezone('utc',now())"),
      notNull: true,
    },
  });
};

exports.down = false;
