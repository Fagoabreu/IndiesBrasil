exports.up = (pgm) => {
  // ── Tabela de enquetes ──
  pgm.createTable("polls", {
    id: { type: "serial", primaryKey: true },
    question: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
    ended_at: { type: "timestamptz" },
  });

  // ── Coluna foreign key no posts ──
  pgm.addColumn("posts", {
    poll_id: { type: "integer", references: '"polls"(id)', onDelete: "SET NULL" },
  });
  pgm.addConstraint("posts", "posts_poll_id_unique", { unique: ["poll_id"] });
  pgm.createIndex("posts", "poll_id");

  // ── Opções da enquete ──
  pgm.createTable("poll_options", {
    id: { type: "serial", primaryKey: true },
    poll_id: { type: "integer", notNull: true, references: '"polls"(id)', onDelete: "CASCADE" },
    label: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });
  pgm.createIndex("poll_options", "poll_id");

  // ── Votos da enquete ──
  pgm.createTable("poll_votes", {
    id: { type: "serial", primaryKey: true },
    poll_option_id: { type: "integer", notNull: true, references: '"poll_options"(id)', onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: '"users"(id)', onDelete: "CASCADE" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });

  pgm.addConstraint("poll_votes", "poll_votes_option_user_unique", {
    unique: ["poll_option_id", "user_id"],
  });

  pgm.createIndex("poll_votes", "poll_option_id");
  pgm.createIndex("poll_votes", "user_id");
};

exports.down = (pgm) => {
  pgm.dropTable("poll_votes");
  pgm.dropTable("poll_options");
  pgm.dropColumn("posts", "poll_id");
  pgm.dropTable("polls");
};
