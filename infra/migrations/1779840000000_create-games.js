/**
 * Migration: Tabelas de Jogos
 *
 * Tabelas criadas:
 *   game_store     — catálogo de lojas (Steam, itch.io, etc.)
 *   games          — tabela principal de jogos com slug, cover, banner
 *   game_media     — screenshots e vídeos do jogo
 *   game_platforms — plataformas suportadas
 *   game_tags      — M2M com tags
 *   games_teams    — créditos da equipe
 *   game_followers — usuários que seguem um jogo
 *   game_reviews   — avaliações de usuários (1–5 estrelas)
 *   store_page     — links para lojas com preço
 */

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * Drop legacy draft tables created by the database_enums migration
   * (1754361140791) that are replaced by the proper tables below.
   * Using IF EXISTS so this is safe on a clean database too.
   * --------------------------------------------------------------- */
  pgm.sql(`
    DROP TABLE IF EXISTS "store_page" CASCADE;
    DROP TABLE IF EXISTS "review" CASCADE;
    DROP TABLE IF EXISTS "game_platforms" CASCADE;
    DROP TABLE IF EXISTS "games_teams" CASCADE;
    DROP TABLE IF EXISTS "games" CASCADE;
    DROP TABLE IF EXISTS "game_store" CASCADE;
  `);

  /* ---------------------------------------------------------------
   * 1. game_store: catálogo de tipos de loja
   * --------------------------------------------------------------- */
  pgm.createTable("game_store", {
    id: { type: "serial", primaryKey: true },
    name: { type: "varchar(50)", notNull: true },
    ico: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },
  });

  pgm.sql(`
    INSERT INTO game_store (name) VALUES
      ('Steam'),
      ('itch.io'),
      ('Epic Games Store'),
      ('GOG'),
      ('Google Play'),
      ('App Store'),
      ('Xbox'),
      ('PlayStation');
  `);

  /* ---------------------------------------------------------------
   * 2. games: tabela principal
   * --------------------------------------------------------------- */
  pgm.createTable("games", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    slug: { type: "varchar(120)", notNull: true, unique: true },
    name: { type: "varchar(255)", notNull: true },
    short_description: { type: "varchar(255)" },
    description: { type: "text" },
    release_date: { type: "date" },
    owner_org_id: {
      type: "uuid",
      references: "organizations(id)",
      onDelete: "SET NULL",
    },
    owner_id: {
      type: "uuid",
      references: "users(id)",
      onDelete: "SET NULL",
    },
    genre: { type: "varchar(50)", notNull: true, default: "'Indefinido'" },
    engine: { type: "varchar(50)" },
    stage: { type: "varchar(30)", notNull: true, default: "'concept'" },
    website_url: { type: "varchar(512)" },
    trailer_url: { type: "varchar(512)" },
    cover_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },
    banner_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("games", "owner_org_id");
  pgm.createIndex("games", "stage");

  /* ---------------------------------------------------------------
   * 3. game_media: screenshots e vídeos
   * --------------------------------------------------------------- */
  pgm.createTable("game_media", {
    id: { type: "serial", primaryKey: true },
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    media_type: { type: "varchar(10)", notNull: true }, // 'image' | 'video'
    url: { type: "varchar(512)", notNull: true },
    caption: { type: "varchar(255)" },
    display_order: { type: "integer", notNull: true, default: 0 },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("game_media", "game_id");

  /* ---------------------------------------------------------------
   * 4. game_platforms
   * --------------------------------------------------------------- */
  pgm.createTable("game_platforms", {
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    platform: { type: "varchar(30)", notNull: true },
  });

  pgm.addConstraint(
    "game_platforms",
    "game_platforms_pkey",
    "PRIMARY KEY (game_id, platform)",
  );

  /* ---------------------------------------------------------------
   * 5. game_tags: M2M com a tabela tags
   * --------------------------------------------------------------- */
  pgm.createTable("game_tags", {
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    tag_id: {
      type: "uuid",
      notNull: true,
      references: "tags(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.addConstraint(
    "game_tags",
    "game_tags_pkey",
    "PRIMARY KEY (game_id, tag_id)",
  );

  /* ---------------------------------------------------------------
   * 6. games_teams: créditos da equipe
   * --------------------------------------------------------------- */
  pgm.createTable("games_teams", {
    id: { type: "serial", primaryKey: true },
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    team_member_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    roles: { type: "varchar(100)" },
  });

  pgm.addConstraint(
    "games_teams",
    "games_teams_game_member_uniq",
    "UNIQUE (game_id, team_member_id)",
  );
  pgm.createIndex("games_teams", "game_id");

  /* ---------------------------------------------------------------
   * 7. game_followers
   * --------------------------------------------------------------- */
  pgm.createTable("game_followers", {
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    follower_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "game_followers",
    "game_followers_pkey",
    "PRIMARY KEY (game_id, follower_id)",
  );

  /* ---------------------------------------------------------------
   * 8. game_reviews: avaliações 1–5 estrelas
   * --------------------------------------------------------------- */
  pgm.createTable("game_reviews", {
    id: { type: "serial", primaryKey: true },
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    reviewer_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    rating: { type: "smallint", notNull: true },
    content: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "game_reviews",
    "game_reviews_game_reviewer_uniq",
    "UNIQUE (game_id, reviewer_id)",
  );
  pgm.addConstraint(
    "game_reviews",
    "game_reviews_rating_check",
    "CHECK (rating BETWEEN 1 AND 5)",
  );
  pgm.createIndex("game_reviews", "game_id");

  /* ---------------------------------------------------------------
   * 9. store_page: links de lojas com preço
   * --------------------------------------------------------------- */
  pgm.createTable("store_page", {
    id: { type: "serial", primaryKey: true },
    game_id: {
      type: "uuid",
      references: "games(id)",
      onDelete: "CASCADE",
    },
    page_url: { type: "varchar(255)" },
    store_type_id: {
      type: "integer",
      references: "game_store(id)",
      onDelete: "SET NULL",
    },
    price: { type: "numeric(10,2)" },
  });

  pgm.createIndex("store_page", "game_id");
};

exports.down = (pgm) => {
  pgm.dropTable("store_page", { cascade: true });
  pgm.dropTable("game_reviews", { cascade: true });
  pgm.dropTable("game_followers", { cascade: true });
  pgm.dropTable("games_teams", { cascade: true });
  pgm.dropTable("game_tags", { cascade: true });
  pgm.dropTable("game_platforms", { cascade: true });
  pgm.dropTable("game_media", { cascade: true });
  pgm.dropTable("games", { cascade: true });
  pgm.dropTable("game_store", { cascade: true });
};
