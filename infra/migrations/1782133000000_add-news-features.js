/**
 * Adiciona features de notícias a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:news',
          'read:news:all',
          'create:news',
          'update:news',
          'delete:news',
          'create:news:rating',
          'create:news:factcheck',
          'create:news:comment'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
