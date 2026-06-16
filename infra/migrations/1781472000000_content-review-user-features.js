/**
 * Adiciona features de análises/reviews a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:content_review',
          'read:content_review:all',
          'create:content_review',
          'update:content_review',
          'delete:content_review'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
