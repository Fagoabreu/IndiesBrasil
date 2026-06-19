/**
 * Adiciona features de edição/exclusão de comentários de aula
 * a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'update:course:comment',
          'delete:course:comment'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
