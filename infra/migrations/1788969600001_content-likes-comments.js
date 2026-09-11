/**
 * Curtidas e comentários para jogos, jogos de mesa e livros.
 *
 * Espelham post_likes / comments, permitindo interação social nas páginas de
 * conteúdo do estúdio. O id de game_comments/boardgame_comments/book_comments
 * usa `serial` para manter compatibilidade com as tabelas de reviews.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE game_likes (
      game_id    uuid        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (game_id, user_id)
    );
    CREATE INDEX game_likes_user_idx ON game_likes (user_id, game_id);

    CREATE TABLE game_comments (
      id         serial       PRIMARY KEY,
      game_id    uuid         NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      author_id  uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    text         NOT NULL,
      created_at timestamptz  NOT NULL DEFAULT now()
    );
    CREATE INDEX game_comments_game_idx ON game_comments (game_id, created_at DESC);

    CREATE TABLE boardgame_likes (
      boardgame_id uuid        NOT NULL REFERENCES boardgames(id) ON DELETE CASCADE,
      user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (boardgame_id, user_id)
    );
    CREATE INDEX boardgame_likes_user_idx ON boardgame_likes (user_id, boardgame_id);

    CREATE TABLE boardgame_comments (
      id           serial       PRIMARY KEY,
      boardgame_id uuid         NOT NULL REFERENCES boardgames(id) ON DELETE CASCADE,
      author_id    uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content      text         NOT NULL,
      created_at   timestamptz  NOT NULL DEFAULT now()
    );
    CREATE INDEX boardgame_comments_boardgame_idx ON boardgame_comments (boardgame_id, created_at DESC);

    CREATE TABLE book_likes (
      book_id    uuid        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (book_id, user_id)
    );
    CREATE INDEX book_likes_user_idx ON book_likes (user_id, book_id);

    CREATE TABLE book_comments (
      id         serial       PRIMARY KEY,
      book_id    uuid         NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      author_id  uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    text         NOT NULL,
      created_at timestamptz  NOT NULL DEFAULT now()
    );
    CREATE INDEX book_comments_book_idx ON book_comments (book_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS book_comments;
    DROP TABLE IF EXISTS book_likes;
    DROP TABLE IF EXISTS boardgame_comments;
    DROP TABLE IF EXISTS boardgame_likes;
    DROP TABLE IF EXISTS game_comments;
    DROP TABLE IF EXISTS game_likes;
  `);
};
