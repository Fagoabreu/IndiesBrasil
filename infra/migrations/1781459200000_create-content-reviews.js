exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE content_reviews (
      id              uuid          PRIMARY KEY,
      slug            varchar(300)  NOT NULL UNIQUE,
      title           varchar(255)  NOT NULL,
      author_id       uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_type    varchar(20)   NOT NULL,
      content_id      uuid          NOT NULL,
      cover_image_id  varchar(256)  REFERENCES uploaded_images(id),
      rating          int,
      sections        text          DEFAULT '[]' NOT NULL,
      positive_points text          DEFAULT '[]' NOT NULL,
      negative_points text          DEFAULT '[]' NOT NULL,
      published_at    timestamptz   DEFAULT now() NOT NULL,
      created_at      timestamptz   DEFAULT now() NOT NULL,
      updated_at      timestamptz   DEFAULT now() NOT NULL
    );

    CREATE INDEX ON content_reviews (author_id);
    CREATE INDEX ON content_reviews (content_type, content_id);
    CREATE INDEX ON content_reviews (published_at DESC);
    CREATE INDEX ON content_reviews (slug);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS content_reviews;`);
};
