/**
 * Migration: PDF + Lojas para Livros/Quadrinhos
 *
 * Alterações:
 *   books              — nova coluna pdf_url
 *   book_store         — catálogo de lojas para livros
 *   book_store_page    — links de compra por livro com preço
 */

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. books: adicionar pdf_url
   * --------------------------------------------------------------- */
  pgm.addColumn("books", {
    pdf_url: { type: "varchar(512)" },
  });

  /* ---------------------------------------------------------------
   * 2. book_store: catálogo de lojas de livros
   * --------------------------------------------------------------- */
  pgm.createTable("book_store", {
    id: { type: "serial", primaryKey: true },
    name: { type: "varchar(80)", notNull: true },
  });

  pgm.sql(`
    INSERT INTO book_store (name) VALUES
      ('Amazon'),
      ('Submarino'),
      ('Americanas'),
      ('Magazine Luíza'),
      ('Mercado Livre'),
      ('Livraria Cultura'),
      ('Martins Fontes'),
      ('Estante Virtual'),
      ('Travessa'),
      ('Saraiva'),
      ('Loja própria'),
      ('Catarse'),
      ('Apoia.se'),
      ('Kickante'),
      ('Loja física');
  `);

  /* ---------------------------------------------------------------
   * 3. book_store_page: links de compra por livro
   * --------------------------------------------------------------- */
  pgm.createTable("book_store_page", {
    id: { type: "serial", primaryKey: true },
    book_id: {
      type: "uuid",
      notNull: true,
      references: "books(id)",
      onDelete: "CASCADE",
    },
    store_type_id: {
      type: "integer",
      notNull: true,
      references: "book_store(id)",
      onDelete: "RESTRICT",
    },
    page_url: { type: "varchar(512)" },
    price: { type: "numeric(10,2)" },
  });

  pgm.createIndex("book_store_page", "book_id");
};

exports.down = (pgm) => {
  pgm.dropTable("book_store_page");
  pgm.dropTable("book_store");
  pgm.dropColumn("books", "pdf_url");
};
