exports.up = (pgm) => {
  pgm.addColumn("users", {
    avatar_url: {
      type: "varchar[256]",
      default: null,
    },
  });

  pgm.createIndex("posts", "created_at", {
    name: "idx_posts_created_at",
  });

  pgm.createIndex("post_likes", "post_id", {
    name: "idx_post_likes_post_id",
  });

  pgm.createIndex("post_likes", ["user_id", "post_id"], {
    name: "idx_post_likes_user_post",
  });

  pgm.createIndex("comments", "post_id", {
    name: "idx_comments_post_id",
  });
};

exports.down = false;
