/**
 * Adiciona features de jogos de mesa a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:boardgame',
          'read:boardgame:all',
          'create:boardgame',
          'update:boardgame',
          'delete:boardgame',
          'create:boardgame:follow',
          'read:boardgame:follow'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
