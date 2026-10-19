/**
 * Adiciona as features de interação em assets a usuários já ativados.
 *
 * Espelha `create:book:like` / `create:book:comment` / `create:book:review` /
 * `update:book:review`: curtir, comentar e avaliar exigem sessão, enquanto ler
 * (a página e a lista de comentários/avaliações) continua público.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'create:asset:like',
          'create:asset:comment',
          'create:asset:review',
          'update:asset:review'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
