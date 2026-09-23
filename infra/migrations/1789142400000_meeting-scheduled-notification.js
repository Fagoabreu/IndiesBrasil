/**
 * Adiciona o tipo de notificação de reunião agendada no estúdio.
 *
 * A agenda é um calendário, não um aviso: sem esta notificação, o membro só
 * descobre uma reunião nova se entrar na página de reuniões do estúdio por
 * conta própria.
 *
 * `noTransaction: true` porque o PostgreSQL exige que o novo valor do enum seja
 * commitado antes de ser usado — mesmo motivo das migrations irmãs
 * (studio-notification-types, studio-invitation-notification).
 *
 * Título e mensagem são resolvidos no cliente, via lib/notifications.js.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_meeting_scheduled';`);
};

// Valores de enum não podem ser removidos com segurança no PostgreSQL.
exports.down = () => {};
