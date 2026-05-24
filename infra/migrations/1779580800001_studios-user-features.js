/**
 * Adiciona features de estúdios a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:studio',
          'create:studio',
          'update:studio',
          'delete:studio',
          'read:studio:member',
          'create:studio:member',
          'delete:studio:member',
          'read:studio:invitation',
          'create:studio:invitation',
          'read:studio:follow',
          'create:studio:follow'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
