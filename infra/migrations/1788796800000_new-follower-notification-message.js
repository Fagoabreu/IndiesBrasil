/**
 * Atualiza a mensagem da notificação 'new_follower' para incluir o
 * @username do novo seguidor.
 *
 * O placeholder %userId é substituído no cliente (NotificationButton.js e
 * pages/perfil/[username]/index.js) pelo username do usuário de origem
 * (source_username), que no caso de 'new_follower' é o novo seguidor.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE notification_messages
    SET message = '@%userId começou a te seguir.', updated_at = now()
    WHERE type = 'new_follower';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE notification_messages
    SET message = 'Um novo Inscrito.', updated_at = now()
    WHERE type = 'new_follower';
  `);
};
