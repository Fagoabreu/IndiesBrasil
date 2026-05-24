/**
 * Esta migration é intencionalmente vazia.
 *
 * O INSERT em notification_messages para 'studio_invitation' não pode ser feito
 * via migration porque node-pg-migrate reutiliza a mesma conexão de banco para
 * todas as migrations em uma mesma execução. O PostgreSQL bloqueia o uso de
 * um novo valor de enum em qualquer transação cuja snapshot foi capturada antes
 * do COMMIT do ALTER TYPE, o que inclui todas as migrations subsequentes na
 * mesma sessão.
 *
 * Solução: o título e a mensagem de 'studio_invitation' são definidos
 * diretamente no cliente (NotificationButton.js) via CLIENT_NOTIF_DEFS,
 * tornando desnecessário persistir essa linha no banco.
 */
exports.up = (_pgm) => {};
exports.down = (_pgm) => {};
