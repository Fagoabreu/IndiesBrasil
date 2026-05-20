/**
 * Adiciona features de eventos a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:event',
          'read:event:all',
          'create:event',
          'update:event',
          'delete:event',
          'create:event:rsvp',
          'create:event:invitation'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
