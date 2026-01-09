const { unique } = require("next/dist/build/utils");

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("tags", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    name: {
      type: "varchar(50)",
      notNull: true,
      unique: true,
    },

    created_at: {
      type: "timestamptz",
      default: pgm.func("timezone('utc',now())"),
      notNull: true,
    },
  });

  pgm.createTable("post_tags", {
    post_id: {
      type: "int",
      notNull: true,
      refereces: "posts",
      onDelete: "CASCADE",
    },

    tag_id: {
      type: "uuid",
      notNull: true,
      refereces: "tags",
      onDelete: "CASCADE",
    },

    created_at: {
      type: "timestamptz",
      default: pgm.func("timezone('utc',now())"),
      notNull: true,
    },
  });

  pgm.addConstraint("post_tags", "post_tags_pk", {
    primaryKey: ["post_id", "tag_id"],
  });

  pgm.createIndex("post_tags", "created_at", {
    name: "idx_post_tags_created_at",
  });

  pgm.createIndex("tags", "name", {
    name: "idx_tags_name",
  });
};

exports.down = (pgm) => false;
