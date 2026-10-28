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
  org_game_liked: {
    title: "Curtida em jogo",
    message: "@%source curtiu o jogo %subject.",
  },
  org_game_commented: {
    title: "Comentário em jogo",
    message: "@%source comentou no jogo %subject.",
  },
  org_boardgame_liked: {
    title: "Curtida em jogo de mesa",
    message: "@%source curtiu o jogo de mesa %subject.",
  },
  org_boardgame_commented: {
    title: "Comentário em jogo de mesa",
    message: "@%source comentou no jogo de mesa %subject.",
  },
  org_book_liked: {
    title: "Curtida em quadrinho",
    message: "@%source curtiu %subject.",
  },
  org_book_commented: {
    title: "Comentário em quadrinho",
    message: "@%source comentou em %subject.",
  },
  org_asset_liked: {
    title: "Curtida em asset",
    message: "@%source curtiu o asset %subject.",
  },
  org_asset_commented: {
    title: "Comentário em asset",
    message: "@%source comentou no asset %subject.",
  },
  org_asset_reviewed: {
    title: "Avaliação de asset",
    message: "@%source avaliou o asset %subject.",
  },
  org_order_received: {
    title: "Novo pedido",
    message: "@%source fez um pedido na loja do estúdio %org.",
  },
  org_order_updated: {
    title: "Pedido atualizado",
    message: "Um pedido de @%source foi atualizado no estúdio %org.",
  },
  org_meeting_scheduled: {
    title: "Reunião agendada",
    message: '@%source agendou "%subject" no estúdio %org.',
  },
  // Mensagem direta recebida na caixa do estúdio. O MESMO valor de enum
  // (`new_message`) também existe em `CLIENT_NOTIF_DEFS`, para o membro que
  // recebe a mensagem: são tabelas diferentes (`org_notifications` e
  // `user_notifications`) e esta tabela só é consultada para linhas de estúdio,
  // distinguidas por `resource_type`.
  new_message: {
    title: "Nova mensagem",
    message: "@%source escreveu para o estúdio: %subject",
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
    case "org_game_liked":
    case "org_game_commented":
      return `/jogos/${notification.resource_id}`;
    case "org_boardgame_liked":
    case "org_boardgame_commented":
      return `/jogos-de-mesa/${notification.resource_id}`;
    case "org_book_liked":
    case "org_book_commented":
      return `/quadrinhos/${notification.resource_id}`;
    case "org_asset_liked":
    case "org_asset_commented":
    case "org_asset_reviewed":
      return `/assets/${notification.resource_id}`;
    case "org_order_received":
    case "org_order_updated":
      return `/estudios/${notification.org_slug}/pedidos`;
    case "org_meeting_scheduled":
      // A notificação é sobre UMA reunião: leva à página de reuniões do estúdio
      // já apontando para ela (`?meeting=`), e a página rola até o card. Antes
      // o destino era só a lista, e quem tinha várias reuniões agendadas não
      // sabia qual delas tinha acabado de ser criada.
      return notification.resource_id
        ? `/estudios/${notification.org_slug}/reunioes?meeting=${notification.resource_id}`
        : `/estudios/${notification.org_slug}/reunioes`;
    case "new_message":
      // `resource_id` é a conversa; a aba já abre a thread pelo `?conversa=`.
      return `/estudios/${notification.org_slug}/?tab=mensagens&conversa=${notification.resource_id}`;
    default:
      return null;
  }
}

/**
 * Destino de uma notificação **pessoal** (`user_notifications`).
 *
 * Ficava duplicado em dois lugares — o sino (`components/Header/NotificationButton`)
 * e a aba de notificações do perfil (`pages/perfil/[username]`) — com regras que
 * já tinham divergido: o perfil não conhecia `new_message`. Aqui é o registro
 * único; os dois só decidem se o item é clicável (`href != null`).
 *
 * @param {object} notification linha de `user_notifications` (com `org_slug`,
 *   `post_id`, `source_username`).
 * @param {string} username dono da caixa — destino de `new_message`.
 * @returns {string|null}
 */
export function resolveUserNotificationHref(notification, username) {
  switch (notification.type) {
    case "studio_invitation":
      return notification.org_slug ? `/estudios/${notification.org_slug}` : null;
    case "post_liked":
    case "post_commented":
      return notification.post_id != null ? `/posts/${notification.post_id}` : null;
    case "new_message":
      // A caixa de entrada é privada: leva à PRÓPRIA aba de mensagens, e não ao
      // perfil de quem escreveu.
      return username ? `/perfil/${username}?tab=mensagens` : null;
    case "new_follower":
      return notification.source_username ? `/perfil/${notification.source_username}` : null;
    default:
      return null;
  }
}
