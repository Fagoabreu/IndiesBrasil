exports.up = (pgm) => {
  pgm.createTable("uploaded_images", {
    id: {
      type: "varchar(256)",
      primaryKey: true,
      notNull: false,
    },

    display_name: {
      type: "varchar(256)",
      notNull: false,
    },

    filename: {
      type: "varchar(256)",
      notNull: true,
    },
    width: {
      type: "INTEGER",
      notNull: true,
    },
    height: {
      type: "INTEGER",
      notNull: true,
    },
    format: {
      type: "varchar(32)",
      notNull: false,
    },
    tags: {
      type: "varchar(128)[]",
      notNull: true,
      default: "{}",
    },
    resource_type: {
      type: "varchar(256)",
      notNull: false,
    },
    secure_url: {
      type: "varchar(512)",
      notNull: false,
    },

    created_at: {
      type: "timestamptz",
      default: pgm.func("timezone('utc',now())"),
      notNull: true,
    },
  });

  pgm.dropColumn("users", "avatar_url", {
    ifExists: true,
  });

  pgm.addColumn("users", {
    avatar_image: {
      type: "varchar(256)",
      default: null,
    },
  });

  pgm.alterColumn("posts", "img", {
    type: "varchar(256)",
  });

  pgm.alterColumn("contact_type", "img_ico", {
    type: "varchar(256)",
  });

  pgm.alterColumn("game_store", "ico", {
    type: "varchar(256)",
  });

  pgm.alterColumn("organizations", "img", {
    type: "varchar(256)",
  });

  pgm.addConstraint("users", "user_images_id_fkey", {
    foreignKeys: {
      columns: "avatar_image",
      references: "uploaded_images(id)",
    },
  });

  pgm.addConstraint("posts", "posts_images_id_fkey", {
    foreignKeys: {
      columns: "img",
      references: "uploaded_images(id)",
    },
  });

  pgm.addConstraint("contact_type", "contact_images_id_fkey", {
    foreignKeys: {
      columns: "img_ico",
      references: "uploaded_images(id)",
    },
  });

  pgm.addConstraint("game_store", "game_store_images_id_fkey", {
    foreignKeys: {
      columns: "ico",
      references: "uploaded_images(id)",
    },
  });

  pgm.addConstraint("organizations", "organizations_images_id_fkey", {
    foreignKeys: {
      columns: "img",
      references: "uploaded_images(id)",
    },
  });
};

exports.down = false;
