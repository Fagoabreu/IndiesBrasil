/**
 * Migration: Sistema de reputação (pontuação de comunidade)
 *
 * Adiciona uma pontuação não-punitiva de reputação para distinguir usuários
 * ativos e confiáveis de usuários abusivos. A pontuação é acumulada por um
 * ledger imutável (`reputation_events`) que garante auditoria, idempotência
 * e o enforcement de limites diários (anti-vício — evita recompensar o uso
 * compulsivo da rede).
 *
 * - `users.reputation`            — total denormalizado para leitura rápida.
 * - `reputation_events`           — histórico auditável de cada evento.
 *   - UNIQUE (user_id, action, reference_id) garante que a mesma ação sobre
 *     o mesmo alvo nunca pontue duas vezes.
 */
exports.up = (pgm) => {
  pgm.addColumn("users", {
    reputation: {
      type: "integer",
      notNull: true,
      default: 0,
    },
  });

  pgm.sql(`
    CREATE TABLE reputation_events (
      id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action       varchar(40)   NOT NULL,
      points       integer       NOT NULL,
      reference_id varchar(64)   NOT NULL,
      created_at   timestamptz   NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX reputation_events_one_per_target
      ON reputation_events (user_id, action, reference_id);

    CREATE INDEX reputation_events_user_created
      ON reputation_events (user_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS reputation_events;`);
  pgm.dropColumn("users", "reputation");
};
