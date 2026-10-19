/**
 * Migration: interações em assets — curtidas, comentários e avaliações.
 *
 * Espelham `book_likes` / `book_comments` / `book_reviews` (e, antes delas,
 * `game_*` / `boardgame_*`): o asset é conteúdo do estúdio e precisa do mesmo
 * conjunto social que jogos e livros — curtir, comentar e dar nota de 1 a 5.
 *
 * As três tabelas têm `ON DELETE CASCADE` para o asset e para o usuário:
 * excluir o asset (ou o estúdio, que apaga os assets) não deixa interação
 * órfã, e excluir a conta leva junto o que a pessoa curtiu/comentou/avaliou.
 *
 * `asset_reviews` tem `UNIQUE (asset_id, reviewer_id)`: a nota é uma por pessoa,
 * editável (PATCH), como em livros.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE asset_likes (
      asset_id   uuid        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (asset_id, user_id)
    );
    CREATE INDEX asset_likes_user_idx ON asset_likes (user_id, asset_id);

    CREATE TABLE asset_comments (
      id         serial      PRIMARY KEY,
      asset_id   uuid        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      author_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    text        NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX asset_comments_asset_idx ON asset_comments (asset_id, created_at DESC);

    CREATE TABLE asset_reviews (
      id          serial      PRIMARY KEY,
      asset_id    uuid        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      reviewer_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating      int         NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content     text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (asset_id, reviewer_id)
    );
    CREATE INDEX asset_reviews_asset_idx ON asset_reviews (asset_id);
    CREATE INDEX asset_reviews_reviewer_idx ON asset_reviews (reviewer_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS asset_reviews;
    DROP TABLE IF EXISTS asset_comments;
    DROP TABLE IF EXISTS asset_likes;
  `);
};
