exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE book_reviews (
      id            serial        PRIMARY KEY,
      book_id       uuid          NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      reviewer_id   uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating        int           NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content       text,
      created_at    timestamptz   NOT NULL DEFAULT now(),
      updated_at    timestamptz   NOT NULL DEFAULT now(),
      UNIQUE (book_id, reviewer_id)
    );
    CREATE INDEX ON book_reviews (book_id);
    CREATE INDEX ON book_reviews (reviewer_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS book_reviews;`);
};
