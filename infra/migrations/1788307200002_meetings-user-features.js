/**
 * Adiciona features de reuniões a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:meeting',
          'create:meeting',
          'update:meeting',
          'delete:meeting'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
