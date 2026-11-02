/**
 * Ações sobre notificações — os endpoints de "marcar como lida".
 *
 * ## Por que existe
 *
 * A marcação estava espalhada e **incompleta**: o sino (`NotificationButton`)
 * marcava ao clicar, mas a aba de notificações do perfil só navegava — abrir a
 * lista completa e clicar num item nunca marcava nada, e a notificação voltava
 * como não lida para sempre. Além disso, as três chamadas (`user_notifications`,
 * `post_notifications`, `org_notifications`) têm corpos diferentes, e cada tela
 * repetia a escolha do endpoint.
 *
 * Aqui ficam a classificação da linha e as três chamadas num só lugar. As duas
 * telas importam daqui; nenhuma decide endpoint por conta própria.
 *
 * Nenhuma função engole erro: `fetch` que devolve `!ok` vira `Error` com a
 * mensagem do servidor. Silenciar a falha era metade do problema — a interface
 * otimista marcava como lida e o item voltava na próxima abertura sem aviso.
 */

/**
 * Notificação do feed do estúdio?
 *
 * Identificada por `resource_type`, que só `org_notifications` tem. Não use
 * `org_slug`: `user_notifications` também tem o campo, e `studio_invitation` e
 * `new_message` o preenchem — classificá-las como do estúdio mandaria o PATCH
 * para a rota errada.
 */
export function isOrgNotification(notification) {
  return notification?.resource_type != null;
}

/**
 * Notificação presa a um post?
 *
 * `post_liked` e `post_commented` vivem em `post_notifications` e têm `post_id`
 * como parte da chave primária — por isso o endpoint é outro.
 */
export function isPostNotification(notification) {
  return !isOrgNotification(notification) && notification?.post_id != null;
}

/** Não lida? `is_read` é boolean nas três origens. */
export function isUnread(notification) {
  return !notification?.is_read;
}

/**
 * Identidade estável de uma linha na tela.
 *
 * Serve de `key` do React e de alvo do update otimista. Precisa funcionar para as
 * três formas: `org_notifications` tem `id`; as pessoais têm chave composta
 * (`user_id` + `type` + `source_user_id` + `org_slug`, ou `+ post_id`). O sino
 * montava essa string à mão em dois formatos diferentes — divergir ali faz o
 * React reaproveitar o nó errado.
 */
export function notificationKey(notification) {
  if (!notification) return "";

  if (isOrgNotification(notification)) {
    return `org:${notification.id}`;
  }

  const base = `user:${notification.user_id}:${notification.type}:${notification.source_user_id}:${notification.org_slug || ""}`;
  return isPostNotification(notification) ? `${base}:${notification.post_id}` : base;
}

function endpointFor(username, notification) {
  const base = `/api/v1/users/${encodeURIComponent(username)}/notifications`;
  if (isOrgNotification(notification)) return `${base}/org`;
  if (isPostNotification(notification)) return `${base}/post`;
  return base;
}

function bodyFor(notification) {
  if (isOrgNotification(notification)) {
    // A rota do estúdio identifica a linha só pelo id.
    return { notification_id: notification.id };
  }

  const body = {
    user_id: notification.user_id,
    type: notification.type,
    source_user_id: notification.source_user_id,
    is_read: true,
    org_slug: notification.org_slug || "",
  };

  // `post_id` faz parte da chave de `post_notifications`; mandá-lo para a rota
  // sem post não quebraria, mas o endpoint é escolhido justamente por ele.
  return isPostNotification(notification) ? { ...body, post_id: notification.post_id } : body;
}

/**
 * Marca **uma** notificação como lida.
 *
 * @throws {Error} quando a resposta não é 2xx — quem chama decide se reverte o
 *   estado otimista e o que mostrar.
 */
export async function markNotificationRead(username, notification) {
  const response = await fetch(endpointFor(username, notification), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(bodyFor(notification)),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Não foi possível marcar a notificação como lida.");
  }
}

/**
 * Marca **todas** as não lidas de uma lista.
 *
 * Em paralelo: são poucas linhas e, em série, a última só sairia depois de N idas
 * ao servidor. Devolve as que falharam em vez de lançar na primeira — uma
 * notificação problemática não pode impedir as outras de serem marcadas.
 *
 * @returns {Promise<Array<object>>} as notificações que **não** foram marcadas
 */
export async function markAllNotificationsRead(username, notifications = []) {
  const pending = notifications.filter(isUnread);

  const results = await Promise.allSettled(pending.map((notification) => markNotificationRead(username, notification).then(() => notification)));

  return results.map((result, index) => (result.status === "rejected" ? pending[index] : null)).filter(Boolean);
}
