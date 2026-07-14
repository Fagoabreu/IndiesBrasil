import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ActionMenu, ActionList, IconButton } from "@primer/react";
import { BellIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./NotificationButton.module.css";

// Tipos de notificação cujas mensagens não estão na tabela notification_messages
// (não podem ser inseridas via migration pelo limite de snapshot do PostgreSQL).
const CLIENT_NOTIF_DEFS = {
  studio_invitation: {
    title: "Convite de estúdio",
    message: "%userId te convidou para o estúdio %studio_name.",
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
  const [userRes, postRes] = await Promise.all([
    fetch(`/api/v1/users/${username}/notifications`, {
      credentials: "include",
    }),
    fetch(`/api/v1/users/${username}/notifications/post`, {
      credentials: "include",
    }),
  ]);
  return {
    userNotifs: userRes.ok ? await userRes.json() : [],
    postNotifs: postRes.ok ? await postRes.json() : [],
  };
}

async function markNotificationRead(username, n) {
  const isPost = n.post_id != null;
  const url = isPost
    ? `/api/v1/users/${username}/notifications/post`
    : `/api/v1/users/${username}/notifications`;
  const body = {
    user_id: n.user_id,
    type: n.type,
    source_user_id: n.source_user_id,
    is_read: true,
    org_slug: n.org_slug || "",
    ...(isPost && { post_id: n.post_id }),
  };
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

export default function NotificationButton() {
  const router = useRouter();
  const { user } = useUser();
  const [userNotifs, setUserNotifs] = useState([]);
  const [postNotifs, setPostNotifs] = useState([]);

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    loadNotifications(user.username).then(
      ({ userNotifs: u, postNotifs: p }) => {
        if (!active) return;
        setUserNotifs(u);
        setPostNotifs(p);
      },
    );
    return () => {
      active = false;
    };
  }, [user?.username]);

  function handleMenuOpen(open) {
    if (!open || !user?.username) return;
    loadNotifications(user.username).then(
      ({ userNotifs: u, postNotifs: p }) => {
        setUserNotifs(u);
        setPostNotifs(p);
      },
    );
  }

  function handleMarkRead(n) {
    if (n.is_read) return;
    if (n.post_id != null) {
      setPostNotifs((prev) =>
        prev.map((p) =>
          p.user_id === n.user_id &&
          p.type === n.type &&
          p.source_user_id === n.source_user_id &&
          p.post_id === n.post_id
            ? { ...p, is_read: true }
            : p,
        ),
      );
    } else {
      setUserNotifs((prev) =>
        prev.map((u) =>
          u.user_id === n.user_id &&
          u.type === n.type &&
          u.source_user_id === n.source_user_id &&
          u.org_slug === n.org_slug
            ? { ...u, is_read: true }
            : u,
        ),
      );
    }
    markNotificationRead(user.username, n);
    if (n.type === "studio_invitation" && n.org_slug) {
      router.push(`/estudios/${n.org_slug}`);
    } else if (n.type === "post_liked" || n.type === "post_commented") {
      router.push(`/posts/${n.post_id}`);
    }
  }

  const all = [...userNotifs, ...postNotifs].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
  const unreadCount = all.filter((n) => !n.is_read).length;

  return (
    <div className={styles.bellWrapper}>
      <ActionMenu onOpenChange={handleMenuOpen}>
        <ActionMenu.Anchor>
          <IconButton
            icon={BellIcon}
            variant="invisible"
            aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
          />
        </ActionMenu.Anchor>

        <ActionMenu.Overlay width="medium">
          <ActionList>
            {all.length === 0 ? (
              <ActionList.Item disabled>Nenhuma notificação</ActionList.Item>
            ) : (
              all.map((n) => (
                <ActionList.Item
                  key={`${n.user_id}_${n.type}_${n.source_user_id}${n.post_id != null ? `_${n.post_id}` : ""}`}
                  className={!n.is_read ? styles.unreadItem : undefined}
                  onSelect={() => handleMarkRead(n)}
                >
                  <span className={styles.notifRow}>
                    <span className={styles.notifTitle}>{resolveTitle(n)}</span>
                    <span className={styles.notifDate}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      }).format(new Date(n.created_at))}
                    </span>
                  </span>
                  {resolveMessage(n) && (
                    <span className={styles.notifMessage}>
                      {resolveMessage(n)}
                    </span>
                  )}
                </ActionList.Item>
              ))
            )}
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
