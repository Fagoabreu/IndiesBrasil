/**
 * Adiciona as features de mensagem direta a usuários já ativados.
 * Novos usuários passam a recebê-las durante a ativação (activation.js).
 *
 * `read:message` e `create:message` ficam juntas porque não existe caso de uso
 * em que faça sentido ter uma sem a outra: quem pode ler pode responder.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:message',
          'create:message'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
