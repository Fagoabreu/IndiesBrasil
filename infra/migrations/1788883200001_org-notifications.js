/**
 * Cria o feed compartilhado de notificações do estúdio.
 *
 * - org_notifications: uma única linha por evento (post curtido/comentado,
 *   avaliação de jogo/jogo de mesa/livro, pedido recebido/atualizado).
 *   Os membros enxergam o evento via JOIN com org_members, sem fan-out.
 * - org_notification_reads: marca de leitura por usuário (por isso o feed
 *   pode ser compartilhado sem um estado de leitura global).
 *
 * recipient_role permite restringir a visibilidade por papel no futuro
 * ('member', 'admin', 'owner'). Hoje tudo é criado como 'member'.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE org_notifications (
      id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          uuid              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      type            notification_type NOT NULL,
      source_user_id  uuid              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_type   varchar(32)       NOT NULL,
      resource_id     text              NOT NULL,
      subject_title   text              NOT NULL,
      recipient_role  varchar(16)       NOT NULL DEFAULT 'member',
      created_at      timestamptz       NOT NULL DEFAULT now()
    );

    CREATE INDEX org_notifications_org_created_idx
      ON org_notifications (org_id, created_at DESC);
    CREATE INDEX org_notifications_source_idx
      ON org_notifications (source_user_id);

    CREATE TABLE org_notification_reads (
      notification_id uuid        NOT NULL REFERENCES org_notifications(id) ON DELETE CASCADE,
      user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at         timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (notification_id, user_id)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS org_notification_reads;`);
  pgm.sql(`DROP TABLE IF EXISTS org_notifications;`);
};
