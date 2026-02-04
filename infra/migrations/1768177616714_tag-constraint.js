exports.up = (pgm) => {
  pgm.addConstraint("post_tags", "post_tags_post_id_fkey", {
    foreignKeys: {
      columns: "post_id",
      references: "posts(id)",
      onDelete: "CASCADE",
    },
  });

  // 3. Adiciona FK tag_id → tags
  pgm.addConstraint("post_tags", "post_tags_tag_id_fkey", {
    foreignKeys: {
      columns: "tag_id",
      references: "tags(id)",
      onDelete: "CASCADE",
    },
  });
};
