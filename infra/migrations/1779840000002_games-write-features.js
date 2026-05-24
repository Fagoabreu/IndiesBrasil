/**
 * Adiciona features de escrita de jogos a usuários já ativados.
 * create:game, update:game e delete:game são necessárias para criar/editar/excluir jogos.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'create:game',
          'update:game',
          'delete:game'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
