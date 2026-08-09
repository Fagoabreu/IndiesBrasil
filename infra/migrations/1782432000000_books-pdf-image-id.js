exports.up = (pgm) => {
  pgm.addColumn("books", {
    pdf_image_id: {
      type: "varchar(256)",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("books", "pdf_image_id");
};
