/**
 * Adiciona as features de assets a usuários já ativados.
 *
 * Novos usuários passam a recebê-las durante a ativação (`models/activation.js`);
 * esta migration cobre quem já tinha `create:session` antes da seção existir —
 * sem ela, todo mundo perderia o acesso até se cadastrar de novo.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:asset',
          'read:asset:all',
          'create:asset',
          'update:asset',
          'delete:asset',
          'read:asset_category',
          'read:asset_category:all'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
