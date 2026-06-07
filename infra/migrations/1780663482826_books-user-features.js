/**
 * Adiciona features de livros/quadrinhos a usuários já ativados.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:book',
          'read:book:all',
          'create:book',
          'update:book',
          'delete:book',
          'create:book:follow',
          'read:book:follow'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
