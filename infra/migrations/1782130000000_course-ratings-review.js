exports.up = (pgm) => {
  pgm.addColumn("course_ratings", {
    review: {
      type: "text",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("course_ratings", "review");
};
