/**
 * Migration: Tabela de Livros e Quadrinhos
 *
 * Tabelas criadas:
 *   books             — tabela principal (título, isbn, editora, tipo, etc.)
 *   book_followers    — usuários que seguem um livro/quadrinho
 */

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. books: tabela principal
   * --------------------------------------------------------------- */
  pgm.createTable("books", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    slug: { type: "varchar(120)", notNull: true, unique: true },
    title: { type: "varchar(255)", notNull: true },
    subtitle: { type: "varchar(255)" },
    short_description: { type: "varchar(255)" },
    description: { type: "text" },
    book_type: {
      type: "varchar(30)",
      notNull: true,
      default: "'book'",
      // book | comic | manga | graphic_novel | zine | artbook | rpg_manual
    },
    isbn: { type: "varchar(20)" },
    publisher: { type: "varchar(200)" },
    edition: { type: "varchar(80)" },
    pages: { type: "smallint" },
    language: { type: "varchar(60)", default: "'Português'" },
    release_date: { type: "date" },
    stage: {
      type: "varchar(30)",
      notNull: true,
      default: "'concept'",
      // concept | writing | crowdfunding | production | released | cancelled
    },
    website_url: { type: "varchar(512)" },
    buy_url: { type: "varchar(512)" },
    // External cover URL (e.g. link provided by user)
    cover_url_external: { type: "varchar(512)" },
    // Uploaded cover image reference
    cover_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },
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

  pgm.createIndex("books", "owner_org_id");
  pgm.createIndex("books", "book_type");
  pgm.createIndex("books", "stage");

  /* ---------------------------------------------------------------
   * 2. book_followers
   * --------------------------------------------------------------- */
  pgm.createTable("book_followers", {
    book_id: {
      type: "uuid",
      notNull: true,
      references: "books(id)",
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
    "book_followers",
    "book_followers_pkey",
    "PRIMARY KEY (book_id, follower_id)",
  );
  pgm.createIndex("book_followers", "follower_id");
};

exports.down = (pgm) => {
  pgm.dropTable("book_followers");
  pgm.dropTable("books");
};
