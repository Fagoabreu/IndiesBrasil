exports.up = (pgm) => {
  pgm.addColumns("organizations", {
    twitch_channel: { type: "varchar(100)", notNull: false },
    youtube_channel_id: { type: "varchar(100)", notNull: false },
  });

  pgm.createTable("org_stream_status", {
    org_id: {
      type: "uuid",
      notNull: true,
      references: '"organizations"',
      onDelete: "CASCADE",
    },
    platform: { type: "varchar(10)", notNull: true }, // 'twitch' | 'youtube'
    is_live: { type: "boolean", notNull: true, default: false },
    viewer_count: { type: "integer" },
    stream_title: { type: "text" },
    stream_thumbnail_url: { type: "varchar(512)" },
    category_name: { type: "varchar(255)" },
    checked_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("org_stream_status", "org_stream_status_pkey", "PRIMARY KEY (org_id, platform)");
};

exports.down = (pgm) => {
  pgm.dropTable("org_stream_status");
  pgm.dropColumns("organizations", ["twitch_channel", "youtube_channel_id"]);
};
