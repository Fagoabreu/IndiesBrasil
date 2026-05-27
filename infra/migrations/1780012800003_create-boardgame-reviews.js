exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE boardgame_reviews (
      id            serial        PRIMARY KEY,
      boardgame_id  uuid          NOT NULL REFERENCES boardgames(id) ON DELETE CASCADE,
      reviewer_id   uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating        int           NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content       text,
      created_at    timestamptz   NOT NULL DEFAULT now(),
      updated_at    timestamptz   NOT NULL DEFAULT now(),
      UNIQUE (boardgame_id, reviewer_id)
    );
    CREATE INDEX ON boardgame_reviews (boardgame_id);
    CREATE INDEX ON boardgame_reviews (reviewer_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS boardgame_reviews;`);
};
