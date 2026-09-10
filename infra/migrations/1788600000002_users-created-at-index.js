/**
 * Migration: users_created_at_index
 *
 * A listagem de membros (`GET /api/v1/users`) passou a ser paginada por
 * keyset — `ORDER BY u.created_at DESC, u.id DESC` com cursor
 * `(created_at, id) < (...)`. Sem índice composto esse ORDER BY força um
 * sort completo da tabela `users` a cada página, o que degrada rápido
 * conforme a base cresce. O índice cobre tanto o ORDER BY quanto o
 * predicado do cursor.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX users_created_at_id_idx
      ON users (created_at DESC, id DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS users_created_at_id_idx;`);
};
