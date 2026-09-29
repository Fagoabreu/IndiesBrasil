/**
 * Índice único parcial que faz o feed do estúdio ter **uma** notificação por
 * conversa, e não uma por mensagem.
 *
 * `org_notifications` foi criada sem chave única (é um feed de eventos), então
 * `upsertConversationNotification` precisa de uma restrição para poder usar
 * `ON CONFLICT`. O índice é parcial de propósito: só vale para
 * `resource_type = 'conversation'` — os outros tipos continuam podendo repetir
 * (dois pedidos do mesmo cliente são dois eventos, e devem ser).
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX org_notifications_conversation_unique
      ON org_notifications (org_id, type, resource_id)
      WHERE resource_type = 'conversation';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS org_notifications_conversation_unique;`);
};
