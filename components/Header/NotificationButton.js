import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ActionMenu, ActionList, IconButton, Avatar } from "@primer/react";
import { BellIcon, DotFillIcon, CheckIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import {
  resolveOrgNotificationTitle,
  resolveOrgNotificationMessage,
  resolveOrgNotificationHref,
  resolveUserNotificationHref,
} from "@/lib/notifications";
import { isOrgNotification, isUnread, markAllNotificationsRead, markNotificationRead, notificationKey } from "@/lib/notificationActions";
import styles from "./NotificationButton.module.css";

// Tipos de notificação cujas mensagens não estão na tabela notification_messages
// (não podem ser inseridas via migration pelo limite de snapshot do PostgreSQL).
const CLIENT_NOTIF_DEFS = {
  studio_invitation: {
    title: "Convite de estúdio",
    message: "%userId te convidou para o estúdio %studio_name.",
  },
  store_order_received: {
    title: "Novo pedido na loja",
    message: "%userId fez um novo pedido na sua loja.",
  },
  store_order_updated: {
    title: "Pedido atualizado",
    message: "O status de um pedido foi atualizado na loja %orgSlug.",
  },
  // Mensagem direta. Se o remetente for um estúdio (`org_slug` preenchido), a
  // mensagem diz isso — a autoria é do estúdio, embora o humano esteja gravado.
  new_message: {
    title: "Nova mensagem",
    message: "%userId enviou uma mensagem para você.",
  },
};

function resolveTitle(n) {
  return n.title || CLIENT_NOTIF_DEFS[n.type]?.title || n.type;
}

function resolveMessage(n) {
  const template = n.message || CLIENT_NOTIF_DEFS[n.type]?.message;
  if (!template) return null;
  return template
    .replace("%userId", n.source_username || "alguém")
    .replace("%postId", n.post_id ? String(n.post_id).slice(0, 8) : "um post")
    .replace("%orgSlug", n.org_slug || "estúdio")
    .replace("%studio_name", n.studio_name || n.org_slug || "estúdio");
}

async function loadNotifications(username) {
  const [userRes, postRes, orgRes] = await Promise.all([
    fetch(`/api/v1/users/${username}/notifications`, {
      credentials: "include",
    }),
    fetch(`/api/v1/users/${username}/notifications/post`, {
      credentials: "include",
    }),
    fetch(`/api/v1/users/${username}/notifications/org`, {
      credentials: "include",
    }),
  ]);
  return {
    userNotifs: userRes.ok ? await userRes.json() : [],
    postNotifs: postRes.ok ? await postRes.json() : [],
    orgNotifs: orgRes.ok ? await orgRes.json() : [],
  };
}

/** As três listas são exibidas juntas; o estado guarda a união. */
function flatten({ userNotifs, postNotifs, orgNotifs }) {
  return [...userNotifs, ...postNotifs, ...orgNotifs];
}

export default function NotificationButton() {
  const router = useRouter();
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    loadNotifications(user.username).then((data) => {
      if (!active) return;
      setNotifications(flatten(data));
    });
    return () => {
      active = false;
    };
  }, [user?.username]);

  function handleMenuOpen(open) {
    setError(null);
    if (!open || !user?.username) return;
    // Recarrega ao abrir: o feed muda por ação de outra pessoa (mensagem,
    // curtida), e a lista montada no login envelhece.
    loadNotifications(user.username).then((data) => setNotifications(flatten(data)));
  }

  /** Aplica `is_read` a uma linha — pelo `notificationKey`, que é o id estável. */
  function setRead(target, read) {
    const key = notificationKey(target);
    setNotifications((prev) => prev.map((n) => (notificationKey(n) === key ? { ...n, is_read: read } : n)));
  }

  /**
   * Abre a notificação.
   *
   * Marcar e navegar são coisas separadas: um `if (n.is_read) return` no topo já
   * existiu e o efeito era notificação lida não abrir nada. O sino lista
   * histórico — clicar sempre leva ao conteúdo, e marca se ainda não estava lida.
   *
   * A marcação é otimista **com reversão**: antes a falha era engolida, o item
   * ficava "lido" na tela e voltava como não lido na próxima abertura, sem
   * nenhuma explicação.
   */
  async function handleMarkRead(n) {
    const href = isOrgNotification(n) ? resolveOrgNotificationHref(n) : resolveUserNotificationHref(n, user.username);

    if (isUnread(n)) {
      setRead(n, true);
      try {
        await markNotificationRead(user.username, n);
      } catch (err) {
        setRead(n, false);
        setError(err.message);
      }
    }

    if (href) router.push(href);
  }

  /** "Marcar todas": as que falharem voltam para não lidas, com aviso. */
  async function handleMarkAll() {
    const unread = notifications.filter(isUnread);
    if (unread.length === 0) return;

    setError(null);
    setBulkBusy(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      const failed = await markAllNotificationsRead(user.username, unread);
      if (failed.length > 0) {
        for (const n of failed) setRead(n, false);
        setError(
          `${failed.length} ${failed.length === 1 ? "notificação não pôde" : "notificações não puderam"} ser marcada${failed.length === 1 ? "" : "s"}.`,
        );
      }
    } finally {
      setBulkBusy(false);
    }
  }

  const all = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = all.filter(isUnread).length;

  return (
    <div className={styles.bellWrapper}>
      <ActionMenu onOpenChange={handleMenuOpen}>
        <ActionMenu.Anchor>
          <IconButton icon={BellIcon} variant="invisible" aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`} />
        </ActionMenu.Anchor>

        <ActionMenu.Overlay width="medium">
          <ActionList>
            {unreadCount > 0 && (
              <>
                <ActionList.Item onSelect={handleMarkAll} disabled={bulkBusy} className={styles.bulkAction}>
                  <ActionList.LeadingVisual>
                    <CheckIcon />
                  </ActionList.LeadingVisual>
                  {bulkBusy ? "Marcando…" : `Marcar todas como lidas (${unreadCount})`}
                </ActionList.Item>
                <ActionList.Divider />
              </>
            )}

            {error && (
              <ActionList.Item disabled className={styles.errorItem}>
                {error}
              </ActionList.Item>
            )}

            {all.length === 0 ? (
              <ActionList.Item disabled>Nenhuma notificação</ActionList.Item>
            ) : (
              all.map((n) => {
                const org = isOrgNotification(n);
                const title = org ? resolveOrgNotificationTitle(n) : resolveTitle(n);
                const message = org ? resolveOrgNotificationMessage(n) : resolveMessage(n);
                const unread = isUnread(n);

                return (
                  <ActionList.Item key={notificationKey(n)} className={unread ? styles.unreadItem : undefined} onSelect={() => handleMarkRead(n)}>
                    {/* A bolinha é o sinal que faltava: o fundo sozinho não
                        distinguia nada (e o token CSS usado nem existia no
                        Primer, então a regra era descartada). */}
                    <ActionList.LeadingVisual>
                      {unread ? <DotFillIcon className={styles.unreadDot} aria-label="Não lida" /> : null}
                    </ActionList.LeadingVisual>

                    {org && (
                      <span className={styles.orgChip}>
                        <Avatar src={n.org_logo_url || "/images/studio.jpg"} size={16} alt="" />
                        <span className={styles.orgChipName}>{n.org_name || "Estúdio"}</span>
                      </span>
                    )}

                    <span className={styles.notifRow}>
                      <span className={`${styles.notifTitle} ${unread ? styles.notifTitleUnread : ""}`}>{title}</span>
                      <span className={styles.notifDate}>
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        }).format(new Date(n.created_at))}
                      </span>
                    </span>
                    {message && <span className={styles.notifMessage}>{message}</span>}
                  </ActionList.Item>
                );
              })
            )}

            <ActionList.Divider />
            <ActionList.Item as={Link} href={`/perfil/${user?.username}?tab=notifications`}>
              Ver todas as notificações
            </ActionList.Item>
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>

      {unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
}
