/**
 * Adiciona a feature `update:post` a usuários já ativados.
 * Novos usuários passam a recebê-la durante a ativação (activation.js).
 *
 * `update:post` é necessária para encerrar enquetes do próprio autor
 * (endPoll), mas foi introduzida sem backfill para contas ativadas
 * anteriormente, causando 403 ao encerrar a própria enquete.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'update:post'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
