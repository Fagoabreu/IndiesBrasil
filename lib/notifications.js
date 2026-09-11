// Helpers compartilhados para renderização de notificações do estúdio.
// As mensagens não estão na tabela notification_messages por limitação de
// snapshot do PostgreSQL (novos valores de enum não podem ser inseridos em
// uma migration subsequente na mesma sessão).

const ORG_NOTIF_TEMPLATES = {
  org_post_liked: {
    title: "Curtida em post",
    message: "@%source curtiu um post do estúdio %org.",
  },
  org_post_commented: {
    title: "Comentário em post",
    message: "@%source comentou em um post do estúdio %org.",
  },
  org_game_reviewed: {
    title: "Avaliação de jogo",
    message: "@%source avaliou o jogo %subject.",
  },
  org_boardgame_reviewed: {
    title: "Avaliação de jogo de mesa",
    message: "@%source avaliou o jogo de mesa %subject.",
  },
  org_book_reviewed: {
    title: "Avaliação de quadrinho",
    message: "@%source avaliou %subject.",
  },
  org_order_received: {
    title: "Novo pedido",
    message: "@%source fez um pedido na loja do estúdio %org.",
  },
  org_order_updated: {
    title: "Pedido atualizado",
    message: "Um pedido de @%source foi atualizado no estúdio %org.",
  },
};

export function resolveOrgNotificationTitle(notification) {
  return ORG_NOTIF_TEMPLATES[notification.type]?.title || notification.type;
}

export function resolveOrgNotificationMessage(notification) {
  const template = ORG_NOTIF_TEMPLATES[notification.type]?.message;
  if (!template) return null;

  return template
    .replace("%source", notification.source_username || "alguém")
    .replace("%org", notification.org_name || "estúdio")
    .replace("%subject", notification.subject_title || "");
}

export function resolveOrgNotificationHref(notification) {
  switch (notification.type) {
    case "org_post_liked":
    case "org_post_commented":
      return `/posts/${notification.resource_id}`;
    case "org_game_reviewed":
      return `/jogos/${notification.resource_id}`;
    case "org_boardgame_reviewed":
      return `/jogos-de-mesa/${notification.resource_id}`;
    case "org_book_reviewed":
      return `/quadrinhos/${notification.resource_id}`;
    case "org_order_received":
    case "org_order_updated":
      return `/estudios/${notification.org_slug}/pedidos`;
    default:
      return null;
  }
}
