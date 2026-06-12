exports.up = (pgm) => {
  // ── Tabela de notícias ──
  pgm.createTable("news", {
    id: { type: "serial", primaryKey: true },
    author_id: { type: "uuid", notNull: true, references: '"users"(id)', onDelete: "CASCADE" },
    title: { type: "text", notNull: true },
    summary: { type: "text", notNull: true },
    body: { type: "text", notNull: true },
    img: { type: "varchar(256)", references: '"uploaded_images"(id)', onDelete: "SET NULL" },
    source_url: { type: "text" },
    source_label: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });

  pgm.createIndex("news", "author_id");
  pgm.createIndex("news", "created_at");

  // ── Avaliações em estrelas (1-5) ──
  pgm.createTable("news_ratings", {
    id: { type: "serial", primaryKey: true },
    news_id: { type: "integer", notNull: true, references: '"news"(id)', onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: '"users"(id)', onDelete: "CASCADE" },
    rating: { type: "smallint", notNull: true, check: "rating >= 1 AND rating <= 5" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });

  pgm.addConstraint("news_ratings", "news_ratings_news_user_unique", {
    unique: ["news_id", "user_id"],
  });

  // ── Fact-check ──
  pgm.createTable("news_factchecks", {
    id: { type: "serial", primaryKey: true },
    news_id: { type: "integer", notNull: true, references: '"news"(id)', onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: '"users"(id)', onDelete: "CASCADE" },
    vote: { type: "text", notNull: true, check: "vote IN ('factcheck', 'fake')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });

  pgm.addConstraint("news_factchecks", "news_factchecks_news_user_unique", {
    unique: ["news_id", "user_id"],
  });

  // ── Comentários de notícias ──
  pgm.createTable("news_comments", {
    id: { type: "serial", primaryKey: true },
    news_id: { type: "integer", notNull: true, references: '"news"(id)', onDelete: "CASCADE" },
    author_id: { type: "uuid", notNull: true, references: '"users"(id)', onDelete: "CASCADE" },
    content: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });

  pgm.createIndex("news_comments", "news_id");
  pgm.createIndex("news_comments", "author_id");

  // ── Links externos da notícia ──
  pgm.createTable("news_sources", {
    id: { type: "serial", primaryKey: true },
    news_id: { type: "integer", notNull: true, references: '"news"(id)', onDelete: "CASCADE" },
    url: { type: "text", notNull: true },
    label: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("timezone('utc', now())") },
  });

  pgm.createIndex("news_sources", "news_id");

  // ── Conceder features para usuários existentes ──
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'create:news',
          'read:news',
          'read:news:all',
          'update:news',
          'delete:news',
          'create:news:rating',
          'create:news:factcheck',
          'create:news:comment'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
