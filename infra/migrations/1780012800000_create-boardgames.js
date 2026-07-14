/**
 * Migration: Tabelas de Jogos de Mesa
 *
 * Tabelas criadas:
 *   boardgames           — tabela principal (categoria, estágio, contagem de jogadores, tempo, peso)
 *   boardgame_mechanics  — mecânicas do jogo (M2M)
 *   boardgame_followers  — usuários que seguem um jogo de mesa
 */

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. boardgames: tabela principal
   * --------------------------------------------------------------- */
  pgm.createTable("boardgames", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    slug: { type: "varchar(120)", notNull: true, unique: true },
    name: { type: "varchar(255)", notNull: true },
    short_description: { type: "varchar(255)" },
    description: { type: "text" },
    category: {
      type: "varchar(30)",
      notNull: true,
      default: "'board_game'",
      // board_game | card_game | rpg | dice_game | miniature | party_game
    },
    stage: {
      type: "varchar(30)",
      notNull: true,
      default: "'concept'",
      // concept | prototype | crowdfunding | production | released | cancelled
    },
    player_count_min: { type: "smallint" },
    player_count_max: { type: "smallint" },
    play_time_min: { type: "smallint" }, // minutes
    play_time_max: { type: "smallint" }, // minutes
    age_rating: { type: "smallint" },
    weight: { type: "decimal(3,1)" }, // 1.0–5.0 (BGG-style complexity)
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
    website_url: { type: "varchar(512)" },
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

  pgm.createIndex("boardgames", "owner_org_id");
  pgm.createIndex("boardgames", "category");
  pgm.createIndex("boardgames", "stage");

  /* ---------------------------------------------------------------
   * 2. boardgame_mechanics: mecânicas do jogo
   * --------------------------------------------------------------- */
  pgm.createTable("boardgame_mechanics", {
    boardgame_id: {
      type: "uuid",
      notNull: true,
      references: "boardgames(id)",
      onDelete: "CASCADE",
    },
    mechanic: { type: "varchar(60)", notNull: true },
  });

  pgm.addConstraint(
    "boardgame_mechanics",
    "boardgame_mechanics_pkey",
    "PRIMARY KEY (boardgame_id, mechanic)",
  );

  /* ---------------------------------------------------------------
   * 3. boardgame_followers
   * --------------------------------------------------------------- */
  pgm.createTable("boardgame_followers", {
    boardgame_id: {
      type: "uuid",
      notNull: true,
      references: "boardgames(id)",
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
    "boardgame_followers",
    "boardgame_followers_pkey",
    "PRIMARY KEY (boardgame_id, follower_id)",
  );
};

exports.down = (pgm) => {
  pgm.dropTable("boardgame_followers");
  pgm.dropTable("boardgame_mechanics");
  pgm.dropTable("boardgames");
};
