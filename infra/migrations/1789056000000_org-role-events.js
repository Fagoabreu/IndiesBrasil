/**
 * Auditoria de papéis do estúdio.
 *
 * `org_roles` é destrutivo por natureza: revogar um papel **apaga a linha**, e
 * remover um membro apaga todas as dele. Sem uma tabela de eventos, a pergunta
 * "quem virou administrador, quando e por ordem de quem" não tem resposta — e
 * essa é a primeira pergunta de um incidente de escalação de privilégio.
 *
 * Append-only: o model só insere (ver `recordRoleEvent` em
 * `models/organization.js`). Não há trigger bloqueando UPDATE/DELETE porque uma
 * trigger protegeria apenas contra bug de aplicação — não contra acesso direto
 * ao banco — e adicionaria atrito operacional sem ganho real.
 *
 * `actor_id` é ON DELETE SET NULL: apagar a conta de quem concedeu não pode
 * apagar o registro de que a concessão existiu.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE org_role_event_action AS ENUM ('granted', 'revoked');

    CREATE TABLE org_role_events (
      id          uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      uuid                   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      member_id   uuid                   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        org_member_role        NOT NULL,
      action      org_role_event_action  NOT NULL,
      actor_id    uuid                   REFERENCES users(id) ON DELETE SET NULL,
      created_at  timestamptz            NOT NULL DEFAULT now()
    );

    CREATE INDEX org_role_events_org_created_idx ON org_role_events (org_id, created_at DESC);
    CREATE INDEX org_role_events_member_idx      ON org_role_events (member_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS org_role_events;`);
  pgm.sql(`DROP TYPE IF EXISTS org_role_event_action;`);
};
